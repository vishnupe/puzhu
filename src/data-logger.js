// Firebase App is always required and must be first
const firebase = require("firebase");
import { fireBaseKey, fireBaseDomain, fireBaseDBUrl } from './secrets';
// Add additional services that you want to use
require("firebase/auth/dist/index.cjs");
require("firebase/database/dist/index.cjs");

const config = {
    apiKey: fireBaseKey,
    authDomain: fireBaseDomain,
    databaseURL: fireBaseDBUrl,
};
firebase.initializeApp(config);

// Get a reference to the database service
const database = firebase.database();

export const writeData = (data) => {
    const newPostKey = firebase.database().ref().child('trainData').push().key;
    let updates = {};
    updates['/trainData/' + newPostKey] = data;
    firebase.database().ref().update(updates).catch(() => console.log('Write Failed'));
}