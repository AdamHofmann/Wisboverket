'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Room, RoomEvent, Track, type RemoteTrack, type RemoteParticipant, type LocalAudioTrack } from 'livekit-client'
import { createClient } from '@/lib/supabase/client'

/**
 * Push-to-talk / walkie-talkie (MVP).
 * - Ett gemensamt öppet rum "wisboverket" — alla inloggade kan prata & lyssna.
 * - Anslut manuellt (spar batteri). Toggle "PRATA" = öppen mik tills man stänger av
 *   (dvs prata fritt utan att hålla knapp). Håll-för-att-prata finns också på knappen.
 * - Native headset-knapp + bakgrundsljud kommer via native-plugin (senare fas).
 *
 * Token hämtas från Edge Functionen `livekit-token` (verifierar Supabase-inloggning).
 */
type Status = 'idle' | 'connecting' | 'connected' | 'error'

const C = {
  panel: '#141414', border: '#2a2a2a', gold: '#E8C96A', text: '#e0e0e0', muted: '#888',
  live: '#4ade80', off: '#333',
}

export default function PushToTalk() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [err, setErr] = useState<string | null>(null)
  const [talking, setTalking] = useState(false)
  const [participants, setParticipants] = useState<{ id: string; name: string }[]>([])
  const [speakingIds, setSpeakingIds] = useState<Set<string>>(new Set())
  const [vox, setVox] = useState(false)          // röststyrt läge på/av
  const [voxSending, setVoxSending] = useState(false) // sänder just nu (röst upptäckt)

  const roomRef = useRef<Room | null>(null)
  const audioElsRef = useRef<HTMLAudioElement[]>([])
  const voxRef = useRef<{ ac: AudioContext; interval: number; track: LocalAudioTrack } | null>(null)

  const refreshParticipants = useCallback((room: Room) => {
    const list = [
      { id: room.localParticipant.identity, name: (room.localParticipant.name || 'Jag') + ' (du)' },
      ...Array.from(room.remoteParticipants.values()).map((p: RemoteParticipant) => ({
        id: p.identity, name: p.name || p.identity,
      })),
    ]
    setParticipants(list)
  }, [])

  const connect = useCallback(async () => {
    setStatus('connecting'); setErr(null)
    try {
      const { data, error } = await createClient().functions.invoke('livekit-token')
      if (error || !data?.token || !data?.url) throw new Error(error?.message || 'Kunde inte hämta token')

      const room = new Room({ adaptiveStream: true, dynacast: true })
      roomRef.current = room

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach()
          el.autoplay = true
          document.body.appendChild(el)
          audioElsRef.current.push(el)
        }
      })
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        setSpeakingIds(new Set(speakers.map((s) => s.identity)))
      })
      room.on(RoomEvent.ParticipantConnected, () => refreshParticipants(room))
      room.on(RoomEvent.ParticipantDisconnected, () => refreshParticipants(room))
      room.on(RoomEvent.Disconnected, () => {
        setStatus('idle'); setTalking(false); setParticipants([]); setSpeakingIds(new Set())
      })

      await room.connect(data.url, data.token)
      // Webbläsares autoplay-policy blockerar annars fjärrljudet. startAudio()
      // måste köras i en användargest — vi är i klick-kontexten från "Anslut".
      try { await room.startAudio() } catch { /* redan tillåtet, eller nekas → ignoreras */ }
      await room.localParticipant.setMicrophoneEnabled(false) // börja tyst (lyssna)
      refreshParticipants(room)
      setStatus('connected')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setStatus('error')
    }
  }, [refreshParticipants])

  const disconnect = useCallback(async () => {
    // Städa VOX-loopen (inlineat för att slippa beroende på stopVox som def:as senare).
    const v = voxRef.current
    if (v) { clearInterval(v.interval); try { await v.ac.close() } catch { /* redan stängd */ } voxRef.current = null }
    setVox(false); setVoxSending(false)
    await roomRef.current?.disconnect()
    roomRef.current = null
    audioElsRef.current.forEach((el) => el.remove())
    audioElsRef.current = []
  }, [])

  const setMic = useCallback(async (on: boolean) => {
    const room = roomRef.current
    if (!room || status !== 'connected') return
    try {
      await room.localParticipant.setMicrophoneEnabled(on)
      setTalking(on)
      setErr(null)
    } catch (e) {
      // Synliggör fel (t.ex. om WKWebView nekar mikrofonen) istället för tyst miss.
      setErr('Mikrofon: ' + (e instanceof Error ? e.message : String(e)))
      setTalking(false)
    }
  }, [status])

  // Röststyrt (VOX): mikrofonen är publicerad men mutad; en AnalyserNode mäter
  // ljudnivån och avmutar automatiskt när du pratar (mutar igen efter en kort
  // "hang" så slutet av meningar inte klipps). Ingen knapptryckning behövs.
  const stopVox = useCallback(async () => {
    const v = voxRef.current
    if (v) { clearInterval(v.interval); try { await v.ac.close() } catch { /* redan stängd */ } voxRef.current = null }
    setVoxSending(false)
    try { await roomRef.current?.localParticipant.setMicrophoneEnabled(false) } catch { /* ej ansluten */ }
  }, [])

  const startVox = useCallback(async () => {
    const room = roomRef.current
    if (!room || status !== 'connected') return
    try {
      await room.localParticipant.setMicrophoneEnabled(true)
      const track = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.audioTrack
      const mst = track?.mediaStreamTrack
      if (!track || !mst) throw new Error('Ingen mikrofon-track')
      await track.mute() // börja tyst — VOX avmutar vid tal
      const ac = new AudioContext()
      const analyser = ac.createAnalyser()
      analyser.fftSize = 512
      ac.createMediaStreamSource(new MediaStream([mst])).connect(analyser)
      const buf = new Uint8Array(analyser.fftSize)
      const THRESHOLD = 0.06, HANG_MS = 800
      let lastSpeech = 0, sending = false
      const interval = window.setInterval(() => {
        analyser.getByteTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; sum += x * x }
        const rms = Math.sqrt(sum / buf.length)
        const now = Date.now()
        if (rms > THRESHOLD) lastSpeech = now
        const shouldSend = now - lastSpeech < HANG_MS
        if (shouldSend && !sending) { sending = true; void track.unmute(); setVoxSending(true) }
        else if (!shouldSend && sending) { sending = false; void track.mute(); setVoxSending(false) }
      }, 100)
      voxRef.current = { ac, interval, track }
      setErr(null)
    } catch (e) {
      setErr('Röststyrt: ' + (e instanceof Error ? e.message : String(e)))
      setVox(false)
      void stopVox()
    }
  }, [status, stopVox])

  const toggleVox = useCallback((on: boolean) => {
    setVox(on)
    if (on) { setTalking(false); void startVox() } // VOX ersätter manuell toggle
    else { void stopVox() }
  }, [startVox, stopVox])

  // Städa upp vid unmount.
  useEffect(() => () => { void disconnect() }, [disconnect])

  const myId = roomRef.current?.localParticipant.identity

  return (
    <>
      {/* Flytande knapp */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Push to talk"
        style={{
          position: 'fixed', right: 'calc(16px + env(safe-area-inset-right))',
          bottom: 'calc(80px + env(safe-area-inset-bottom))', zIndex: 900,
          width: 52, height: 52, borderRadius: '50%', border: `1px solid ${C.border}`,
          background: status === 'connected' ? C.live : '#1a1a1a',
          color: status === 'connected' ? '#111' : C.gold, fontSize: 22, cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
        }}
      >📻</button>

      {open && (
        <div style={{
          position: 'fixed', right: 'calc(16px + env(safe-area-inset-right))',
          bottom: 'calc(142px + env(safe-area-inset-bottom))', zIndex: 900,
          width: 240, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: C.gold }}>📻 WALKIE-TALKIE</span>
            <span style={{ fontSize: 10, color: status === 'connected' ? C.live : C.muted }}>
              {status === 'connected' ? '● Ansluten' : status === 'connecting' ? 'Ansluter…' : status === 'error' ? 'Fel' : 'Frånkopplad'}
            </span>
          </div>

          {status !== 'connected' ? (
            <>
              <button onClick={connect} disabled={status === 'connecting'} style={{
                width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                background: C.gold, color: '#111', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>{status === 'connecting' ? 'Ansluter…' : 'Anslut'}</button>
              {err && <div style={{ fontSize: 11, color: '#f87171', marginTop: 8 }}>{err}</div>}
            </>
          ) : (
            <>
              {/* Läge: manuell toggle eller röststyrt (VOX) */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.muted, marginBottom: 10, cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={vox} onChange={(e) => toggleVox(e.target.checked)} style={{ accentColor: C.gold, width: 16, height: 16 }} />
                🎤 Röststyrt — prata utan att trycka
              </label>

              {vox ? (
                /* Röststyrt: mikrofonen sköts automatiskt, ingen knapp att trycka. */
                <div style={{
                  width: '100%', padding: '16px', borderRadius: 10, marginBottom: 10, textAlign: 'center',
                  fontWeight: 800, fontSize: 15, transition: 'background 0.12s',
                  background: voxSending ? C.live : C.off, color: voxSending ? '#111' : C.text,
                }}>{voxSending ? '🔊 SÄNDER' : '🎧 Lyssnar…'}</div>
              ) : (
                /* Ren toggle: tryck på för att prata fritt, tryck igen för att stänga. */
                <button
                  onClick={() => setMic(!talking)}
                  style={{
                    width: '100%', padding: '16px', borderRadius: 10, border: 'none', marginBottom: 10,
                    background: talking ? C.live : C.off, color: talking ? '#111' : C.text,
                    fontWeight: 800, fontSize: 15, cursor: 'pointer', transition: 'background 0.1s',
                    touchAction: 'manipulation',
                  }}
                >{talking ? '🎙️ LIVE – tryck för att stänga' : 'PRATA'}</button>
              )}
              {err && <div style={{ fontSize: 11, color: '#f87171', marginBottom: 10 }}>{err}</div>}

              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 6 }}>
                I RUMMET ({participants.length})
              </div>
              <div style={{ maxHeight: 140, overflowY: 'auto' }}>
                {participants.map((p) => {
                  const speaking = speakingIds.has(p.id)
                  return (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13,
                      color: speaking ? C.live : C.text, fontWeight: speaking ? 700 : 400,
                    }}>
                      <span style={{ fontSize: 10 }}>{speaking ? '🔊' : (p.id === myId ? '•' : '○')}</span>
                      {p.name}
                    </div>
                  )
                })}
              </div>

              <button onClick={disconnect} style={{
                width: '100%', padding: '8px', borderRadius: 8, marginTop: 10,
                border: `1px solid ${C.border}`, background: 'transparent', color: C.muted,
                fontSize: 12, cursor: 'pointer',
              }}>Koppla från</button>
            </>
          )}
        </div>
      )}
    </>
  )
}
