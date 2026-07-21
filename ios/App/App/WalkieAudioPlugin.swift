import Foundation
import Capacitor
import AVFoundation
import MediaPlayer

/// Native-stöd för walkie-talkien (PTT).
///
/// - `startSession()`: aktiverar en AVAudioSession (playAndRecord / voiceChat) så att
///   ljudet lever kvar även när appen ligger i bakgrunden eller skärmen är släckt
///   (kräver `UIBackgroundModes: audio` i Info.plist, vilket finns), och registrerar
///   headset-/fjärrkontroll-knapparna (play / pause / togglePlayPause). Ett knapptryck
///   på hörlurarna skickar eventet `headsetToggle` till webben, som då togglar
///   sändningen — precis som PRATA-knappen.
/// - `stopSession()`: släpper ljudfokus och avregistrerar inte kommandona (de är
///   ofarliga att ha kvar) men markerar sessionen som inaktiv.
///
/// Registreras automatiskt av Capacitor 8 via `CAPBridgedPlugin` när filen är med i
/// App-target:en (ingen manuell registrering behövs).
@objc(WalkieAudioPlugin)
public class WalkieAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WalkieAudioPlugin"
    public let jsName = "WalkieAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopSession", returnType: CAPPluginReturnPromise),
    ]

    private var remoteCommandsRegistered = false

    @objc func startSession(_ call: CAPPluginCall) {
        let session = AVAudioSession.sharedInstance()
        do {
            // voiceChat + playAndRecord: tvåvägs röst, ekosläckning, och bakgrundsljud
            // (tillsammans med UIBackgroundModes: audio). defaultToSpeaker + Bluetooth
            // så att både högtalare och trådlösa headset fungerar.
            try session.setCategory(.playAndRecord,
                                    mode: .voiceChat,
                                    options: [.defaultToSpeaker, .allowBluetooth, .allowBluetoothA2DP])
            try session.setActive(true)
        } catch {
            call.reject("Kunde inte aktivera ljudsession: \(error.localizedDescription)")
            return
        }
        DispatchQueue.main.async { self.registerRemoteCommands() }
        call.resolve()
    }

    @objc func stopSession(_ call: CAPPluginCall) {
        do {
            try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        } catch {
            // Redan inaktiv eller kunde inte släppas — ofarligt, ignoreras.
        }
        call.resolve()
    }

    /// Kopplar headset-/fjärrkontroll-knapparna till `headsetToggle`-eventet. Görs bara
    /// en gång; kommandona ligger kvar hela app-livstiden (billigt och ofarligt).
    private func registerRemoteCommands() {
        guard !remoteCommandsRegistered else { return }
        remoteCommandsRegistered = true

        let center = MPRemoteCommandCenter.shared()
        let toggle: (MPRemoteCommandEvent) -> MPRemoteCommandHandlerStatus = { [weak self] _ in
            self?.notifyListeners("headsetToggle", data: [:])
            return .success
        }
        center.togglePlayPauseCommand.isEnabled = true
        center.togglePlayPauseCommand.addTarget(handler: toggle)
        center.playCommand.isEnabled = true
        center.playCommand.addTarget(handler: toggle)
        center.pauseCommand.isEnabled = true
        center.pauseCommand.addTarget(handler: toggle)

        // Gör appen till "nu spelas"-appen så att hörlurs-/lås-skärmsknappen når oss.
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: "Wisboverket walkie-talkie",
            MPNowPlayingInfoPropertyIsLiveStream: true,
        ]
    }
}
