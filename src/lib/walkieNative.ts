import { registerPlugin, Capacitor } from '@capacitor/core'

/**
 * Brygga till den native WalkieAudio-plugin:en (iOS).
 * - startSession/stopSession: aktiverar/släpper AVAudioSession → bakgrundsljud.
 * - headsetToggle-event: skickas när headset-/fjärrkontroll-knappen trycks.
 *
 * På webben finns ingen native-plugin — därför guardas alla anrop med `isNativeApp`.
 */
export interface WalkieAudioPlugin {
  startSession(): Promise<void>
  stopSession(): Promise<void>
  addListener(
    eventName: 'headsetToggle',
    listenerFunc: () => void,
  ): Promise<{ remove: () => void }>
}

export const WalkieAudio = registerPlugin<WalkieAudioPlugin>('WalkieAudio')

export const isNativeApp = Capacitor.isNativePlatform()
