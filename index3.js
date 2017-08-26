'use strict';

var os = require('os');
var nodeStatic = require('node-static');
var http = require('https');
var socketIO = require('socket.io');
const fs = require('fs');

var fileServer = new(nodeStatic.Server)();
var optionServer = {
	key: fs.readFileSync('C:\\xampp5624\\apache\\conf\\ssl.key\\server.key'),
	cert: fs.readFileSync('C:\\xampp5624\\apache\\conf\\ssl.crt\\server.crt')
};
var app = http.createServer(optionServer, function(req, res) {
	fileServer.serve(req, res);
}).listen(8080);

var users = [];

var io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {

	// convenience function to log server messages on the client
	function log() {
		var array = ['Message from server:'];
		array.push.apply(array, arguments);
		socket.emit('log', array);
	}
	
	function disconnect() {
		var socket_id = socket.id;
		
		// remove user if exist
		var user_key = get_user_key_by_socket_id(socket_id);
		if (user_key !== null)
		{
			// send to all clients
			socket.broadcast.emit('delete_registered', users[user_key]);
			
			// delete on users array
			delete users[user_key];
		}
	}
	
	function get_user_key_by_socket_id(socket_id) {
		for (var user_key in users)
		{
			if (users[user_key].socket_id == socket_id)
				return user_key;
		}
		
		return null;
	}
	
	// { id : docter_id, type : 1/2 (1=>docter, 2=>patient), name : name, photo : url }
	socket.on('register', function(data) {
		// join to general room
		//socket.join('general');
		
		var key = data.type + '@' + data.id;
		
		var user = {
			key			: key,
			id			: data.id,
			socket_id	: socket.id,
			type		: data.type,
			name		: data.name,
			photo		: data.photo
		};
		
		// add to users array
		users[key] = user;
		
		// send to user
		socket.emit('registered', user);
		
		// send to all users
		socket.broadcast.emit('registered_new', user);
	});
	
	socket.on('get_registered_all', function() {
		// remove key from users array using create new user list
		var user_list = [];
		for (var user_key in users)
			user_list.push(users[user_key]);
		
		// send to user
		socket.emit('registered_all', user_list);
	});
	
	socket.on('unregister', function(){
		disconnect();
	});
	
	// default function from socketIO
	socket.on('disconnect', function(){
		disconnect();
	});
	
	// { to : key, message : message }
	socket.on('message_send', function(data){
		var socket_id = socket.id;
		
		var user_from = null;
		var user_to = users[data.to];
		
		var user_key_from = get_user_key_by_socket_id(socket_id);
		if (user_key_from !== null)
			user_from = users[user_key_from];
		
		// send to user to
		if (user_to !== null)
			socket.to(user_to.socket_id).emit('message_receive', {
				'from'		: user_from,
				'message'	: data.message
			});
	});
	
	
	
	socket.on('message', function(message) {
		log('Client said: ', message);
		// for a real app, would be room-only (not broadcast)
		socket.broadcast.emit('message', message);
	});
	
	socket.on('create or join', function(room) {
		log('Received request to create or join room ' + room);

		var numClients = io.sockets.sockets.length;
		log('Room ' + room + ' now has ' + numClients + ' client(s)');

		if (numClients === 1) {
			socket.join(room);
			log('Client ID ' + socket.id + ' created room ' + room);
			socket.emit('created', room, socket.id);

		} else if (numClients === 2) {
			log('Client ID ' + socket.id + ' joined room ' + room);
			io.sockets.in(room).emit('join', room);
			socket.join(room);
			socket.emit('joined', room, socket.id);
			io.sockets.in(room).emit('ready');
		} else { // max two clients
			socket.emit('full', room);
		}
	});

	socket.on('ipaddr', function() {
		var ifaces = os.networkInterfaces();
		for (var dev in ifaces) {
			ifaces[dev].forEach(function(details) {
				if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
					socket.emit('ipaddr', details.address);
				}
			});
		}
	});

	socket.on('bye', function(){
		console.log('received bye');
	});

});