(() => {
  const state = { token: null, stomp: null, currentRoomId: null, username: null };
  const $ = (id) => document.getElementById(id);
  const toast = (msg) => { const t = $("toast"); t.textContent = msg; t.setAttribute('aria-label', msg); t.style.opacity = 1; setTimeout(()=> t.style.opacity = 0, 2000); };

  const api = async (path, opts={}) => {
    const headers = { 'Content-Type': 'application/json' };
    if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
    const res = await fetch(path, { ...opts, headers });
    if (!res.ok) throw new Error(await res.text());
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  };

  const renderRooms = async () => {
    const rooms = await api('/api/rooms/me');
    const ul = $('rooms'); ul.innerHTML = '';
    rooms.forEach(r => {
      const li = document.createElement('li');
      li.textContent = r.room.name || `Room ${r.id?.roomId || ''}`;
      li.onclick = () => joinRoom(r.room.id || r.id?.roomId);
      ul.appendChild(li);
    });
  };

  const renderMessages = async (roomId) => {
    const data = await api(`/api/messages/rooms/${roomId}?page=0&size=50`);
    const ul = $('message-list'); ul.innerHTML = '';
    data.content.forEach(m => {
      const li = document.createElement('li');
      li.textContent = '[encrypted]';
      ul.appendChild(li);
    });
  };

  const connectWs = () => {
    const sock = new SockJS('/ws');
    const stomp = Stomp.over(sock);
    stomp.debug = () => {};
    stomp.connect({ 'Authorization': `Bearer ${state.token}` }, () => {
      state.stomp = stomp;
      toast('Connected');
      if (state.currentRoomId) subscribeRoom(state.currentRoomId);
    }, (err) => toast('WS error'));
  };

  const subscribeRoom = (roomId) => {
    state.stomp.subscribe(`/topic/rooms/${roomId}`, (msg) => {
      const payload = JSON.parse(msg.body);
      const li = document.createElement('li');
      li.textContent = `${payload.sender}: ${payload.text}`;
      if (payload.sender === state.username) li.classList.add('me');
      $('message-list').appendChild(li);
    });
  };

  const joinRoom = async (roomId) => {
    state.currentRoomId = roomId;
    await renderMessages(roomId);
    if (state.stomp) subscribeRoom(roomId);
  };

  $('registerForm').onsubmit = async (e) => {
    e.preventDefault();
    const body = {
      username: $('reg-username').value,
      email: $('reg-email').value,
      displayName: $('reg-display').value,
      password: $('reg-password').value,
    };
    const res = await api('/api/auth/register', { method: 'POST', body: JSON.stringify(body) });
    state.token = res.token; state.username = body.username;
    $('me').textContent = state.username; toast('Registered');
    document.querySelector('.auth').hidden = true; document.querySelector('.chat').hidden = false;
    if (!state.stomp) connectWs(); await renderRooms();
  };

  $('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const body = { username: $('login-username').value, password: $('login-password').value };
    const res = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(body) });
    state.token = res.token; state.username = body.username;
    $('me').textContent = state.username; toast('Logged in');
    document.querySelector('.auth').hidden = true; document.querySelector('.chat').hidden = false;
    if (!state.stomp) connectWs(); await renderRooms();
  };

  $('create-room').onclick = async () => {
    const name = $('room-name').value.trim(); if (!name) return;
    await api('/api/rooms', { method: 'POST', body: JSON.stringify({ name, isPrivate: false }) });
    $('room-name').value = ''; await renderRooms(); toast('Room created');
  };

  $('sendForm').onsubmit = (e) => {
    e.preventDefault();
    const text = $('message-input').value.trim(); if (!text || !state.currentRoomId) return;
    state.stomp.send(`/app/rooms/${state.currentRoomId}/send`, {}, JSON.stringify({ text }));
    $('message-input').value = '';
  };
})();


