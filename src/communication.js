import io from 'socket.io-client';
import {
    Subject
} from 'rxjs';

export const dataChannelIncomingSubject = new Subject();
export const dataChannelOutgoingSubject = new Subject();
export const dataChannelClosingSubject = new Subject();
export const dataChannelOpenedEvent = new Subject();
export const dataChannelClosedEvent = new Subject();

let socket = io('https://lazy-signaling-server.herokuapp.com/');

/****************************************************************************
 * Initial setup
 ****************************************************************************/

let configuration = {
    'iceServers': [{
        url: 'turn:numb.viagenie.ca',
        credential: 'muazkh',
        username: 'webrtc@live.com'
    }]
};

let myClientid;
let isInitiator;
let peerConnections = {};
let dataChannels = {};
window.peerConnections = peerConnections;
window.remoteAudioTracks = [];
// Create a random room if not already present in the URL.
let room = window.location.hash.substring(1);
if (!room) {
    room = window.location.hash = randomToken();
}


/****************************************************************************
 * Signaling server
 ****************************************************************************/
socket.on('connected', function (clientId) {
    console.log('Connected with clientId', clientId);
    myClientid = clientId
});

socket.on('joined', function (clientIds) {
    console.log('joined', clientIds);
    clientIds.forEach(clientId => {
        createPeerConnection(false, configuration, clientId);
    });
});

socket.on('new_client_joined', function (clientId, numClient) {
    console.log('new_client_joined', clientId, numClient);
    // isInitiator = false;
    createPeerConnection(true, configuration, clientId);
});

socket.on('client_left', (clientId) => {
    console.log(clientId, 'Left');
    if (peerConnections[clientId]) {
        delete peerConnections[clientId]
    }
    if (dataChannels[clientId]) {
        delete dataChannels[clientId]
    }
    dataChannelClosedEvent.next({
        clientId
    });
});

socket.on('message', (fromId, message) => {
    var currentConnection = peerConnections[fromId];
    if (currentConnection) {
        if (message.type === 'offer') {
            currentConnection.setRemoteDescription(new RTCSessionDescription(message), () => { },
                logError);
            currentConnection.createAnswer((desc) => {
                currentConnection.setLocalDescription(desc, () => {
                    sendMessage(fromId, currentConnection.localDescription);
                }, logError);
            }, logError);

        } else if (message.type === 'answer') {
            // console.log('Got answer.');
            currentConnection.setRemoteDescription(new RTCSessionDescription(message), () => { },
                logError);

        } else if (message.type === 'candidate') {
            currentConnection.addIceCandidate(new RTCIceCandidate(
                message.candidate
            )).catch((err) => {
                console.log(err)
            });


        } else if (message === 'bye') {
            // TODO: cleanup RTC connection?
        }
    }
});

// Join a room
socket.emit('create or join', room);


/**
 * Send message to signaling server
 */
function sendMessage(toClientid, message) {
    socket.emit('message', toClientid, message);
}

/****************************************************************************
 * WebRTC peer connection and data channel
 ****************************************************************************/

function createPeerConnection(isInitiator, config, clientId) {
    // console.log('Creating Peer connection as initiator?', isInitiator, 'config:', config);
    let peerConn = peerConnections[clientId] = new RTCPeerConnection(config);
    if(window.localAudioStream) {
        window.localAudioStream.getAudioTracks().forEach((track) => {
            console.log('here')
            peerConn.addTrack(track, window.localAudioStream);
        });
    }
    
    peerConn.ontrack = (event) => {
        console.log('Got peer stream', event);
        window.remoteAudioTracks = window.remoteAudioTracks.concat(event.streams[0].getAudioTracks())
        const ac = new AudioContext();
        const audioStream = new MediaStream();
        window.remoteAudioTracks.forEach((track) => {
            audioStream.addTrack(track)
        })
        // WebAudio MediaStream sources only use the first track.
        const audioSource = ac.createMediaStreamSource(audioStream);
        audioSource.connect(ac.destination)

        document.getElementById('audio').srcObject = audioStream;
    };
    // send any ice candidates to the other peer
    peerConn.onicecandidate = function (event) {
        console.log('icecandidate event:', event.candidate);
        if (event.candidate) {
            sendMessage(clientId, {
                type: 'candidate',
                label: event.candidate.sdpMLineIndex,
                id: event.candidate.sdpMid,
                candidate: event.candidate
            });
        } else { }
    };

    if (isInitiator) {
        let dataChannel = peerConn.createDataChannel('channel');
        onDataChannelCreated(dataChannel, clientId);

        peerConn.createOffer((desc) => {
            peerConn.setLocalDescription(desc, function () {
                sendMessage(clientId, peerConn.localDescription);
            }, logError);
        }, logError);
    } else {
        peerConn.ondatachannel = function (event) {
            let dataChannel = event.channel;
            onDataChannelCreated(dataChannel, clientId);
        };
    }
}

function onDataChannelCreated(channel, clientId) {
    // console.log('CHANNEL created!!!');
    let outgoingSubscription;
    channel.onopen = function () {
        // console.log('CHANNEL opened!!!');
        outgoingSubscription = dataChannelOutgoingSubject.subscribe(message => {
            let newMessage = Object.assign({}, message, {
                clientId: myClientid
            })
            channel.send(JSON.stringify(newMessage));
        });
        dataChannelOpenedEvent.next({
            clientId
        });
        dataChannelClosingSubject.subscribe((closingClientId) => {
            if (closingClientId === clientId) {
                console.log('Closing channel', clientId);
                channel.close();
                dataChannelClosedEvent.next({
                    clientId
                });
            }
        })
    };
    channel.onmessage = (message) => {
        dataChannelIncomingSubject.next(JSON.parse(message.data));
    }
    channel.onclose = () => {
        console.log('Closed');
        if (peerConnections[clientId]) {
            delete peerConnections[clientId]
        }
        if (dataChannels[clientId]) {
            delete dataChannels[clientId]
        }
        if (!outgoingSubscription.closed) {
            outgoingSubscription.unsubscribe();
        }
        dataChannelClosedEvent.next({
            clientId
        });
    }
    dataChannels[clientId] = channel;
}

function randomToken() {
    return Math.floor((1 + Math.random()) * 1e16).toString(16).substring(1);
}

function logError(err) {
    console.log(err.toString(), err);
}