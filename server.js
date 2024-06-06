require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();

const url = process.env.MONGODB_URI;
const dbName = 'endangered_animals';
console.log('MongoDB URI:', process.env.MONGODB_URI);

const client = new MongoClient(url);

let db;

app.use(express.static(path.join(__dirname, 'public')));

async function connectToDatabase() {
  try {
    await client.connect();
    console.log('Connected successfully to MongoDB');
    db = client.db(dbName);

    // Start the server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server started on port ${PORT}`);
    });
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  }
}

connectToDatabase();

app.get('/cards', async (req, res) => {
  const { category } = req.query;

  try {
    const collection = db.collection(category.toLowerCase());
    const cards = await collection.find().toArray();

    const cardHTML = cards.map(card => `
      <div class="card">
        <div class="card-picture"> 
          <img src="${card.imagem}" alt="${card.nome}">
        </div>
        
        <div class="card-title">
          <h4>${card.nome}</h4>
        </div>
        <div class="card-description">
          <p class="card-description">${card.descricao}</p>
        </div>
      </div>
    `).join('');

    res.send(cardHTML);
  } catch (err) {
    console.error('Error fetching data from MongoDB:', err);
    res.status(500).send('Server Error');
  }
});
