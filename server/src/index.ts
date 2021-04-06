import { Server } from 'socket.io'
import { createServer } from 'http'
import BingoBackendFactory from './BingoBackendFactory'
import BackendBingoModel from './BackendBingoModel'
import BingoPlayerBuilder from './BingoPlayerBuilder'

start(25565)

function start(port: number) {
   const io = init(port)
   const backend = BingoBackendFactory.create(io)
   const model = new BackendBingoModel({size: 3, items: []})

   const onRegisterUser = backend.observeClientEvent('register-user')
   const onGetState = backend.observeClientEvent('get-state')
   const onRequestStateUpdate = backend.observeClientEvent('request-state-update')

   const update = (bingoCode: string) => backend.broadcast(bingoCode, 'update-state', model.getState())

   onRegisterUser.subscribe(({ client, data: { bingoCode, name, current } }) => {
      const pb = new BingoPlayerBuilder(name, client.getClientId())
      pb.addMissing(current)

      model.addPlayer(model.assignRole(pb.create()))
      client.setBingoCode(bingoCode)

      update(bingoCode)
   })

   onGetState.subscribe(({ client }) => {
      client.send('update-state', model.getState())
   })

   onRequestStateUpdate.subscribe(({ data, client }) => {
      const bingoCode = client.getBingoCode()
      if (bingoCode) {
         model.setState(data)
         update(bingoCode)
      }
   })

   backend.onDisconnect(client => {
      const player = model.findPlayerById(client.getClientId())
      if (player)
         model.removePlayer(player)
      backend.broadcast(client.getBingoCode(), 'update-state', model.getState())
   })

   console.log(`starting bingo server on port ${port}`)
}

function init(port: number) {
   const httpServer = createServer()
   const io = new Server(httpServer, {
      cors: {
         origin: '*',
         methods: 'GET,PUT'
      }
   })
   httpServer.listen(port)
   return io
}