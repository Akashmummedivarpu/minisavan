require('dotenv').config();
const mongoose = require('mongoose');

async function cleanDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        
        await mongoose.connection.collection('rooms').drop().catch(() => console.log('rooms not found'));
        await mongoose.connection.collection('roommembers').drop().catch(() => console.log('roommembers not found'));
        await mongoose.connection.collection('roomplaybackstates').drop().catch(() => console.log('roomplaybackstates not found'));
        console.log('Dropped old collections');
        
    } catch(e) {
        console.log('Error dropping collection:', e.message);
    } finally {
        await mongoose.disconnect();
    }
}

cleanDB();
