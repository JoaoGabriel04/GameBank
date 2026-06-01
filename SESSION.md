[Redis] Conectado
[Socket.IO] Redis adapter configurado
[seed] Admin garantido: gamebank@admin.com (id=6)
[Negociação] Cleanup de expiradas ativo (intervalo: 10s)
Servidor rodando na porta 7000!
[emitToRoom] event="transferencia:toast" room="session:21" sockets=2
[emitToRoom] event="negotiation:toast" room="session:21" sockets=2
[emitToRoom] event="negotiation:toast" room="session:21" sockets=2
[emitToRoom] event="negotiation:toast" room="session:21" sockets=2

# Quem recebeu a negociação e a transferência
[negotiation:toast] type=new targetUserId=3 myId=2 isMyToast=false
socketStore.ts:142 [negotiation:toast] type=accepted targetUserId=2 myId=2 isMyToast=true
socketStore.ts:142 [negotiation:toast] type=accepted targetUserId=3 myId=2 isMyToast=false

# Quem fez a negociação e a transferência
[transferencia:toast] toUserId=2 myId=3 match=false
socketStore.ts:142 [negotiation:toast] type=new targetUserId=3 myId=3 isMyToast=true
socketStore.ts:142 [negotiation:toast] type=accepted targetUserId=2 myId=3 isMyToast=false
socketStore.ts:142 [negotiation:toast] type=accepted targetUserId=3 myId=3 isMyToast=true