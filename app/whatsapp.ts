import { Boom } from '@hapi/boom'
import P from 'pino'
import makeWASocket, {AnyMessageContent, delay, DisconnectReason, fetchLatestBaileysVersion, makeInMemoryStore, useSingleFileAuthState } from '@adiwajshing/baileys'

// the store maintains the data of the WA connection in memory
// can be written out to a file & read from it
const store = makeInMemoryStore({ logger: P().child({ level: 'debug', stream: 'store' }) })
store.readFromFile('./baileys_store_multi.json')
// save every 10s
setInterval(() => {
	store.writeToFile('./baileys_store_multi.json')
}, 10_000)

const { state, saveState } = useSingleFileAuthState('./auth_info_multi.json')

// start a connection
const startSock = async() => {
    const configs = {
        app_name: 'Tester',
        port: 2734,// custom port to access server
        webhook_url: 'http://localhost/waapi/filewebhook/webhook.php',
        webhook_group: 'http://localhost/waapi/hookgroup.php',
        callback_url: 'http://wablast.galkasoft.id/callback.php' // webhook url
    };
    var qrcode = require('qrcode');
    const http = require("http");
    const express = require('express');
    const axios = require("axios");
    const app = express();
    const server = http.createServer(app);
    const socketIO = require('socket.io');
    const io = socketIO(server, {
        cors: {
            origin: "*"
        }
    });
    server.listen(configs.port, () => {
        console.log(`Server listening on ` + configs.port);
    });

    

	// fetch latest version of WA Web
	const { version, isLatest } = await fetchLatestBaileysVersion()
	// console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`)

	const sock = makeWASocket({
		version,
		logger: P({ level: 'trace' }),
		printQRInTerminal: true,
		auth: state,
		// implement to handle retries
		// getMessage: async key => {
		// 	return {
		// 		conversation: 'hello'
		// 	}
		// }
	})

	store.bind(sock.ev)

	// const sendMessageWTyping = async(msg: AnyMessageContent, jid: string) => {
	// 	await sock.presenceSubscribe(jid)
	// 	await delay(500)

	// 	await sock.sendPresenceUpdate('composing', jid)
	// 	await delay(2000)

	// 	await sock.sendPresenceUpdate('paused', jid)

	// 	await sock.sendMessage(jid, msg)
	// }
    
	// sock.ev.on('chats.set', item => console.log(`recv ${item.chats.length} chats (is latest: ${item.isLatest})`))
	// sock.ev.on('messages.set', item => console.log(`recv ${item.messages.length} messages (is latest: ${item.isLatest})`))
	// sock.ev.on('contacts.set', item => console.log(`recv ${item.contacts.length} contacts`))

	// sock.ev.on('messages.upsert', async m => {
	// 	console.log(JSON.stringify(m, undefined, 2))
        
	// 	const msg = m.messages[0]
	// 	if(!msg.key.fromMe && m.type === 'notify') {
	// 		console.log('replying to', m.messages[0].key.remoteJid)
	// 		await sock!.sendReadReceipt(msg.key.remoteJid, msg.key.participant, [msg.key.id])
	// 		await sendMessageWTyping({ text: 'Hello there!' }, msg.key.remoteJid)
	// 	}
        
	// })

	// sock.ev.on('messages.update', m => console.log(m))
	// sock.ev.on('message-receipt.update', m => console.log(m))
	// sock.ev.on('presence.update', m => console.log(m))
	// sock.ev.on('chats.update', m => console.log(m))
	// sock.ev.on('contacts.upsert', m => console.log(m))

	sock.ev.on('connection.update', (update) => {
		const { connection, lastDisconnect } = update
		if(connection === 'close') {
			// reconnect if not logged out
			if((lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut) {
				startSock()
			} else {
				console.log('connection closed')
			}
		}
        
		// console.log('connection update', update)
	})
	// listen for when the auth credentials is updated
	sock.ev.on('creds.update', saveState)

    io.on("connection", function (socket: any) {

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update
            qrcode.toDataURL(qr, (err : any, url:any) => {
                socket.emit('message', 'QR Code received, scan please!')
                console.log(qr);
                socket.emit("qr", url);
            });
            
        })
    })
	// return sock

    app.get("/", (req: any, res: { status: (arg0: number) => { (): any; new(): any; json: { (arg0: { status: boolean; message: string }): any; new(): any } }; writeHead: (arg0: number, arg1: { 'Content-Type': string }) => void; end: (arg0: string) => void }) => {
        const id = '6285792486889@s.whatsapp.net' // the WhatsApp ID 
        // send a simple text!
        const sentMsg  =  sock.sendMessage(id, { text: 'oh hello there' })   
        return res.status(200).json({
                status: true,
                message: "Connected"
            });

        });
}

startSock()