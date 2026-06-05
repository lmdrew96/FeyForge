import { useCallback, useEffect, useRef, useState } from "react"

// DM-side live-captions hook: captures mic audio, streams it to AssemblyAI v3
// over a WebSocket, and hands each FINALIZED line to onFinal. Pure DOM/WS/audio —
// kept Convex-agnostic via callbacks so the caller wires token-mint + persistence.
//
// Adapted from ScribeCat-v3 src/renderer/hooks/use-transcription.ts. The net-new
// piece is CONNECTION ROTATION: AssemblyAI v3 caps a streaming session at 3 hours
// (close code 3005). D&D runs longer, so we proactively open a fresh socket at
// ~2h50m and swap to it seamlessly, keeping the audio graph untouched.

// Rotate before AssemblyAI's hard 3h cap so there's no caption gap.
const ROTATE_AFTER_MS = 170 * 60 * 1000 // 2h50m

// Throttle partial (in-progress) transcript pushes so a fast, long talker still
// streams smoothly without flooding Convex. ~1.5 writes/sec during speech.
const PARTIAL_THROTTLE_MS = 650

const buildWsUrl = (token: string) => {
  const params = new URLSearchParams({
    sample_rate: "16000",
    format_turns: "true",
    token,
  })
  return `wss://streaming.assemblyai.com/v3/ws?${params.toString()}`
}

export interface UseLiveCaptionsOptions {
  // Mint a fresh AssemblyAI streaming token (called on start AND on each rotation).
  getToken: () => Promise<string>
  // Called once per finalized turn with the trimmed line.
  onFinal: (text: string) => void
  // Called (throttled) with the in-progress turn so captions stream live.
  onPartial?: (text: string) => void
  onError?: (error: Error) => void
}

export interface UseLiveCaptions {
  isCapturing: boolean
  error: string | null
  start: () => Promise<void>
  stop: () => void
}

export function useLiveCaptions(options: UseLiveCaptionsOptions): UseLiveCaptions {
  const [isCapturing, setIsCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Latest callbacks, read through refs so the lifecycle functions stay stable
  // and never capture a stale closure.
  const getTokenRef = useRef(options.getToken)
  const onFinalRef = useRef(options.onFinal)
  const onPartialRef = useRef(options.onPartial)
  const onErrorRef = useRef(options.onError)
  getTokenRef.current = options.getToken
  onFinalRef.current = options.onFinal
  onPartialRef.current = options.onPartial
  onErrorRef.current = options.onError

  const wsRef = useRef<WebSocket | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const rotationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isCapturingRef = useRef(false)
  const stoppingRef = useRef(false)
  // rotate() and scheduleRotation() reference each other; route through a ref to
  // avoid a circular useCallback dependency.
  const rotateRef = useRef<() => Promise<void>>(async () => {})

  // Partial-push throttle state.
  const partialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPartialAtRef = useRef(0)

  const flushPartialTimer = useCallback(() => {
    if (partialTimerRef.current) {
      clearTimeout(partialTimerRef.current)
      partialTimerRef.current = null
    }
  }, [])

  // Emit a partial at most once per PARTIAL_THROTTLE_MS, always sending the
  // latest text on the trailing edge so the final partial state isn't dropped.
  const emitPartial = useCallback((text: string) => {
    if (!onPartialRef.current) return
    const now = Date.now()
    const since = now - lastPartialAtRef.current
    flushPartialTimer()
    if (since >= PARTIAL_THROTTLE_MS) {
      lastPartialAtRef.current = now
      onPartialRef.current(text)
    } else {
      partialTimerRef.current = setTimeout(() => {
        partialTimerRef.current = null
        lastPartialAtRef.current = Date.now()
        onPartialRef.current?.(text)
      }, PARTIAL_THROTTLE_MS - since)
    }
  }, [flushPartialTimer])

  const scheduleRotation = useCallback(() => {
    if (rotationTimerRef.current) clearTimeout(rotationTimerRef.current)
    rotationTimerRef.current = setTimeout(() => {
      void rotateRef.current()
    }, ROTATE_AFTER_MS)
  }, [])

  // Retire a socket we've rotated away from: detach handlers (so its close
  // doesn't surface a fatal error), tell AssemblyAI we're done (stops billing),
  // and close it.
  const retireSocket = useCallback((ws: WebSocket) => {
    try {
      ws.onclose = null
      ws.onerror = null
      ws.onmessage = null
      ws.onopen = null
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "Terminate" }))
      }
      ws.close()
    } catch {
      /* already gone */
    }
  }, [])

  // Open a socket with the given token. On rotation we keep audio flowing to the
  // OLD socket until the NEW one opens, then swap wsRef and retire the old one —
  // so the seam is at most a word or two, never a gap.
  const connect = useCallback(
    (token: string, isRotation: boolean) => {
      const oldWs = wsRef.current
      const ws = new WebSocket(buildWsUrl(token))

      ws.onopen = () => {
        isCapturingRef.current = true
        setIsCapturing(true)
        setError(null)
        if (isRotation && oldWs) retireSocket(oldWs)
        wsRef.current = ws
        scheduleRotation()
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string)
          if (message.type === "Turn") {
            const text = String(message.transcript ?? "").trim()
            if (message.end_of_turn === true) {
              // Final supersedes any pending partial — cancel it so a trailing
              // partial can't re-create a stale line after this one commits.
              flushPartialTimer()
              if (text) onFinalRef.current(text)
            } else if (text) {
              emitPartial(text)
            }
          } else if (message.type === "Error") {
            setError(message.error)
            onErrorRef.current?.(new Error(message.error))
          }
        } catch {
          /* ignore unparseable frames */
        }
      }

      ws.onerror = () => {
        // Transient — the close handler decides whether it's fatal.
      }

      ws.onclose = (event) => {
        // A socket we've already rotated past has had its handlers detached, so
        // reaching here means this is the live socket.
        if (wsRef.current !== ws) return
        isCapturingRef.current = false
        setIsCapturing(false)
        if (stoppingRef.current) return
        if (event.code === 3005) {
          // Hit the 3h cap before our proactive rotation — recover by rotating.
          void rotateRef.current()
          return
        }
        const msg = "Live captions stopped unexpectedly. Toggle captions off and on to resume."
        setError(msg)
        onErrorRef.current?.(new Error(msg))
      }

      // For the initial connection, point the audio graph at this socket right
      // away (the worklet guards on readyState until it's OPEN). For a rotation,
      // leave wsRef on the old socket until this one's onopen swaps it.
      if (!isRotation) wsRef.current = ws
    },
    [retireSocket, scheduleRotation, emitPartial, flushPartialTimer],
  )

  const rotate = useCallback(async () => {
    if (!isCapturingRef.current) return
    try {
      const token = await getTokenRef.current()
      connect(token, true)
    } catch (e) {
      const msg = "Couldn't refresh the caption stream. Toggle captions off and on to resume."
      setError(msg)
      onErrorRef.current?.(new Error(e instanceof Error ? e.message : msg))
    }
  }, [connect])
  rotateRef.current = rotate

  const setupAudio = useCallback((stream: MediaStream) => {
    // Do NOT request 16 kHz here — mobile browsers ignore the hint and use their
    // native rate. We detect the real rate and downsample in the worklet.
    const audioContext = new AudioContext()
    audioContextRef.current = audioContext

    // iPadOS may suspend the context during multi-window transitions; resume so
    // the worklet keeps emitting frames and AssemblyAI doesn't time out.
    audioContext.addEventListener("statechange", () => {
      if (
        audioContext.state === "suspended" &&
        isCapturingRef.current &&
        audioContextRef.current === audioContext
      ) {
        audioContext.resume().catch(() => {})
      }
    })

    const source = audioContext.createMediaStreamSource(stream)
    sourceNodeRef.current = source

    const sendChunk = (buf: ArrayBuffer) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(buf)
    }

    const useWorklet = async () => {
      await audioContext.audioWorklet.addModule("/audio-processor.js")
      const workletNode = new AudioWorkletNode(audioContext, "audio-processor", {
        processorOptions: { targetSampleRate: 16000 },
      })
      workletNodeRef.current = workletNode
      workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => sendChunk(event.data)
      source.connect(workletNode)
      workletNode.connect(audioContext.destination)
    }

    const useScriptProcessor = () => {
      const nativeRate = audioContext.sampleRate
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0)
        let data: Float32Array
        if (nativeRate !== 16000) {
          const ratio = nativeRate / 16000
          const outLen = Math.floor(input.length / ratio)
          data = new Float32Array(outLen)
          for (let i = 0; i < outLen; i++) data[i] = input[Math.floor(i * ratio)]
        } else {
          data = input
        }
        const pcm = new Int16Array(data.length)
        for (let i = 0; i < data.length; i++) {
          const s = Math.max(-1, Math.min(1, data[i]))
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
        }
        sendChunk(pcm.buffer)
      }
      source.connect(processor)
      processor.connect(audioContext.destination)
    }

    // Prefer the off-main-thread worklet; fall back to ScriptProcessorNode.
    if (typeof AudioWorkletNode !== "undefined" && audioContext.audioWorklet) {
      return useWorklet().catch(() => useScriptProcessor())
    }
    useScriptProcessor()
    return Promise.resolve()
  }, [])

  const teardownAudio = useCallback(() => {
    for (const ref of [sourceNodeRef, workletNodeRef, processorRef] as const) {
      const node = ref.current as { disconnect?: () => void } | null
      if (node?.disconnect) {
        try {
          node.disconnect()
        } catch {
          /* already disconnected */
        }
      }
      ref.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) track.stop()
      mediaStreamRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    stoppingRef.current = true
    isCapturingRef.current = false
    flushPartialTimer()
    if (rotationTimerRef.current) {
      clearTimeout(rotationTimerRef.current)
      rotationTimerRef.current = null
    }
    if (wsRef.current) {
      retireSocket(wsRef.current)
      wsRef.current = null
    }
    teardownAudio()
    setIsCapturing(false)
  }, [retireSocket, teardownAudio, flushPartialTimer])

  const start = useCallback(async () => {
    if (isCapturingRef.current) return
    stoppingRef.current = false
    setError(null)
    try {
      const token = await getTokenRef.current()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      connect(token, false)
      await setupAudio(stream)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't start live captions."
      setError(msg)
      onErrorRef.current?.(e instanceof Error ? e : new Error(msg))
      stop()
    }
  }, [connect, setupAudio, stop])

  // Stop everything on unmount (also stops AssemblyAI billing).
  useEffect(() => {
    return () => stop()
  }, [stop])

  return { isCapturing, error, start, stop }
}
