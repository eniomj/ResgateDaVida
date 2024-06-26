require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const GridFSBucket = require('mongodb').GridFSBucket;
const crypto = require('crypto');
const cors = require('cors');

const app = express();

const url = process.env.MONGODB_URI;
const dbName = 'endangered_animals';

const client = new MongoClient(url);

let db, bucket;

app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());

async function connectToDatabase() {
  try {
    await client.connect();
    console.log('Connected successfully to MongoDB');
    db = client.db(dbName);
    bucket = new GridFSBucket(db);

    // Inicia o servidor
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

app.use(async (req, res, next) => {
  try {
    const visitorLog = {
      timestamp: new Date(),
      method: req.method,
      url: req.url,
      ipHash: crypto.createHash('sha256').update(req.ip).digest('hex')
    };
    
    const logsCollection = db.collection('visitor_logs');
    await logsCollection.insertOne(visitorLog);

    console.log(`${JSON.stringify(visitorLog)}`);
  } catch (err) {
    console.error('Error', err);
  }

  next();
});

app.get('/image/:fileId', async (req, res) => {
  try {
    const fileId = new ObjectId(req.params.fileId);
    const downloadStream = bucket.openDownloadStream(fileId);

    downloadStream.on('error', () => {
      res.status(404).send('Image not found');
    });

    downloadStream.pipe(res);
  } catch (err) {
    console.error('Error: ', err);
    res.status(500).send('Server Error');
  }
});

app.get('/cards', async (req, res) => {
  const { category } = req.query;

  try {
    const collection = db.collection(category.toLowerCase());
    const cards = await collection.find().toArray();
    
    const cardHTML = cards.map(card => {
      const imageUrl = card.image_file_id ? `/image/${card.image_file_id}` : card.imagem;
      return `
        <div class="card" onclick="showModal(this)">
          <div class="modal-body-top">
            <div class="card-picture"> 
            <img src="${imageUrl}" alt="${card.nome}">
          </div>

          <table class="modal-taxonomy-table">
            <tr>
                <th>Taxonomia</th>
                <th>Classificação</th>
            </tr>
            <tr>
                <td>Espécie</td>
                <td>${card.nome_cientifico}</td>
            </tr>
            <tr>
                <td>Reino</td>
                <td>${card.kingdom}</td>
            </tr>
            <tr>
                <td>Filo</td>
                <td>${card.phylum}</td>
            </tr>
            <tr>
                <td>Classe</td>
                <td>${card.class}</td>
            </tr>
            <tr>
                <td>Ordem</td>
                <td>${card.order}</td>
            </tr>
            <tr>
                <td>Família</td>
                <td>${card.family}</td>
            </tr>
            <tr>
                <td>Gênero</td>
                <td>${card.genus}</td>
            </tr>
          </table>
          </div>
          <div class="card-title">
            <h4>${card.nome}</h4>
          </div>

          <div class="card-description">
            <p class="card-description-text">${card.descricao}</p>
          </div>
          <p class="modal-conservation">Status de conservação: ${card.conservation_status}</p>
        </div>
      `;
    }).join('');

    res.send(cardHTML);
  } catch (err) {
    console.error('Error fetching data from MongoDB:', err);
    res.status(500).send('Server Error');
  }
});

