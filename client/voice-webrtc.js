const ICE_CONFIG = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export function setupVoice(state, socket, btn, statusEl, logLine) {
  const peers = new Map();
  let localStream = null;

  async function ensureStream() {
    if (localStream) return localStream;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      statusEl.textContent = 'Micrófono: activo';
      return localStream;
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Error al acceder al micrófono.';
      return null;
    }
  }

  function createPeerConnection(peerId) {
    const pc = new RTCPeerConnection(ICE_CONFIG);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc-ice-candidate', { to: peerId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      let audioEl = document.querySelector(`audio[data-peer-id="${peerId}"]`);
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.dataset.peerId = peerId;
        audioEl.autoplay = true;
        document.body.appendChild(audioEl);
      }
      audioEl.srcObject = event.streams[0];
    };

    if (localStream) {
      for (const track of localStream.getTracks()) {
        pc.addTrack(track, localStream);
      }
    }

    peers.set(peerId, pc);
    return pc;
  }

  async function callPeer(peerId) {
    const stream = await ensureStream();
    if (!stream) return;
    const pc = createPeerConnection(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('webrtc-offer', { to: peerId, offer });
  }

  btn.addEventListener('click', async () => {
    if (!socket || !socket.connected) {
      alert('Primero conectate a una sala.');
      return;
    }
    const stream = await ensureStream();
    if (!stream) return;
    statusEl.textContent = 'Micrófono: activo. Conectando con jugadores...';
    socket.emit('webrtc-ready');
  });

  window.__arcaneVoice = {
    async onOffer(from, offer) {
      const stream = await ensureStream();
      if (!stream) return;
      let pc = peers.get(from);
      if (!pc) pc = createPeerConnection(from);
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-answer', { to: from, answer });
    },
    async onAnswer(from, answer) {
      const pc = peers.get(from);
      if (!pc) return;
      await pc.setRemoteDescription(answer);
    },
    async onIceCandidate(from, candidate) {
      let pc = peers.get(from);
      if (!pc) pc = createPeerConnection(from);
      await pc.addIceCandidate(candidate);
    },
    onPeers(peerIds) {
      peerIds.forEach((pid) => {
        if (pid !== state.playerId) {
          callPeer(pid);
        }
      });
    },
  };
}
