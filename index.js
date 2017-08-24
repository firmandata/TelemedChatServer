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

var room_general = 'general';
var docters = [];
var patients = [];

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
		
		// remove patient if exist
		var patient = get_patient_from_socket_id(socket_id);
		if (patient !== null)
		{
			// send to all clients
			socket.broadcast.emit('delete_registered_patient', patients[patient.id]);
			
			// delete on patients array
			delete patients[patient.id];
		}
		
		// remove docter if exist
		var docter = get_docter_from_socket_id(socket_id);
		if (docter !== null)
		{
			// send to all clients
			socket.broadcast.emit('delete_registered_docter', docters[docter.id]);
			
			// delete on docters array
			delete docters[docter.id];
		}
	}
	
	function get_patient_from_socket_id(socket_id)
	{
		// get patient by socket_id
		for (var patient_id in patients)
		{
			if (patients[patient_id].socket_id == socket_id)
				return patients[patient_id];
		}
		
		return null;
	}
	
	function get_docter_from_socket_id(socket_id)
	{
		// get docter by socket_id
		for (var docter_id in docters)
		{
			if (docters[docter_id].socket_id == socket_id)
				return docters[docter_id];
		}
		
		return null;
	}
	
	// { id : docter_id, name : docter_name, photo : url }
	socket.on('register_docter', function(data) {
		// joint to general room
		//socket.join(room_general);
		
		// add to docters array
		docters[data.id] = {
			id : data.id,
			socket_id : socket.id,
			name : data.name,
			photo : data.photo
		};
		
		// send to client
		socket.emit('registered_docter', docters[data.id]);
		
		// send to all clients
		socket.broadcast.emit('new_registered_docter', docters[data.id]);
	});
	
	// { id : patient_id, name : patient_name, photo : url }
	socket.on('register_patient', function(data) {
		// joint to general room
		//socket.join(room_general);
		
		// add to patients array
		patients[data.id] = {
			id : data.id,
			socket_id : socket.id,
			name : data.name,
			photo : data.photo
		};
		
		// send to client
		socket.emit('registered_patient', patients[data.id]);
		
		// send to all clients
		socket.broadcast.emit('new_registered_patient', patients[data.id]);
	});
	
	socket.on('get_registered_docters', function(){
		socket.emit('registered_docters', docters);
	});
	
	socket.on('get_registered_patients', function(){
		socket.emit('registered_patients', patients);
	});
	
	socket.on('get_registered_all', function(){
		socket.emit('registered_docters', docters);
		socket.emit('registered_patients', patients);
	});
	
	socket.on('unregister', function(){
		disconnect();
	});
	
	// default function from socketIO
	socket.on('disconnect', function(){
		disconnect();
	});
	
	// { to : to_id, message : message }
	socket.on('message_send', function(data){
		var socket_id = socket.id;
		
		var user_from = null;
		user_from = get_patient_from_socket_id(socket_id);
		if (user_from === null)
			user_from = get_docter_from_socket_id(socket_id);
		
		// find socket_id by id
		var user_to = null;
		if (patients[data.to])
			user_to = patients[data.to];
		else if (docters[data.to])
			user_to = docters[data.to];
		
		// send to client
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
