import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '@/sockets/socket.client';
import { useChannelStore } from '@/stores/channel.store';
import { apiClient } from '@/services/api.client';

interface IceServerConfig {
  iceServers: RTCIceServer[];
}

/**
 * Manages WebRTC peer connections for a voice channel.
 * Handles signaling (SDP + ICE) through the Socket.IO signaling gateway.
 */
export function useWebRTC(channelId: string | null) {
  const peers = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStream = useRef<MediaStream | null>(null);
  const iceServers = useRef<RTCIceServer[]>([
    { urls: 'stun:stun.l.google.com:19302' },
  ]);

  const setSpeaking = useChannelStore((s) => s.setSpeaking);

  // Fetch ICE servers from backend on mount
  useEffect(() => {
    apiClient
      .get<IceServerConfig>('/voice/ice-servers')
      .then((res) => {
        iceServers.current = res.data.iceServers;
      })
      .catch(() => {
        console.warn('[WebRTC] Could not fetch ICE servers, using defaults');
      });
  }, []);

  const createPeer = useCallback(
    (remoteSocketId: string, isInitiator: boolean): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: iceServers.current });
      peers.current.set(remoteSocketId, pc);

      const socket = getSocket();

      // Add local audio tracks
      localStream.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.current!);
      });

      // ICE candidate trickle
      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          socket.emit('rtc:ice', { to: remoteSocketId, candidate });
        }
      };

      // Remote audio
      pc.ontrack = ({ streams }) => {
        const audio = new Audio();
        audio.srcObject = streams[0];
        void audio.play();
      };

      if (isInitiator) {
        pc.onnegotiationneeded = async () => {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('rtc:offer', { to: remoteSocketId, sdp: pc.localDescription });
        };
      }

      return pc;
    },
    [],
  );

  const startAudio = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStream.current = stream;
    // Mute all tracks by default — PTT will unmute them
    stream.getAudioTracks().forEach((t) => (t.enabled = false));
    return stream;
  }, []);

  const enableMic = useCallback(() => {
    localStream.current?.getAudioTracks().forEach((t) => (t.enabled = true));
    setSpeaking(true);
  }, [setSpeaking]);

  const disableMic = useCallback(() => {
    localStream.current?.getAudioTracks().forEach((t) => (t.enabled = false));
    setSpeaking(false);
  }, [setSpeaking]);

  const stopAll = useCallback(() => {
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;
    peers.current.forEach((pc) => pc.close());
    peers.current.clear();
  }, []);

  // Handle incoming signaling events
  useEffect(() => {
    if (!channelId) return;

    const socket = getSocket();

    const handleOffer = async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      const pc = createPeer(from, false);
      await pc.setRemoteDescription(sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('rtc:answer', { to: from, sdp: pc.localDescription });
    };

    const handleAnswer = async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      const pc = peers.current.get(from);
      if (pc) await pc.setRemoteDescription(sdp);
    };

    const handleIce = async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      const pc = peers.current.get(from);
      if (pc) await pc.addIceCandidate(candidate);
    };

    socket.on('rtc:offer', (data: { from: string; sdp: RTCSessionDescriptionInit }) => { void handleOffer(data); });
    socket.on('rtc:answer', (data: { from: string; sdp: RTCSessionDescriptionInit }) => { void handleAnswer(data); });
    socket.on('rtc:ice', (data: { from: string; candidate: RTCIceCandidateInit }) => { void handleIce(data); });

    return () => {
      socket.off('rtc:offer');
      socket.off('rtc:answer');
      socket.off('rtc:ice');
    };
  }, [channelId, createPeer]);

  return { startAudio, enableMic, disableMic, stopAll };
}
