const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const e = require('express');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vmx0jtd.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    const usersCollection = client.db("sportsSchool").collection("users");
    const classesCollection = client.db("sportsSchool").collection("classes");
    const selectedClassesCollection = client.db("sportsSchool").collection("selected-classes");
    const paymentCollection = client.db("sportsSchool").collection("payment");

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token });
    });

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }
    const verifyinstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'instructor') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }

    //users related apis
    //load all users
    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.get('/instructor', async (req, res) => {
      const result = await usersCollection.find({ role: 'instructor' }).toArray();
      res.send(result);
    });

    //insert user
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'User Already Exist' })
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // check admin
    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    });
    // check instructor
    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === 'instructor' }
      res.send(result);
    });

    //make admin
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //make instructor
    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete('/users/delete/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    //class related apis
    //load all classes on admin
    app.get('/classes', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });
    //insert class
    app.post('/classes', verifyJWT, verifyinstructor, async (req, res) => {
      const newItem = req.body;
      const result = await classesCollection.insertOne(newItem);
      res.send(result);
    });
    //change status to accepted
    app.patch('/class/approved/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          status: 'Approved'
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //change status to denied
    app.patch('/class/denied/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          status: 'Denied'
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // get data to instractor
    app.get('/myclasses', verifyJWT, verifyinstructor, async (req, res) => {
      const email = req.query.email;
      if (req.decoded.email === email) {
        const query = { email: email }
        const result = await classesCollection.find(query).toArray();
        res.send(result);
      }
    });
    // get class by id to update
    app.get('/getupdateclass/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classesCollection.findOne(query);
      res.send(result);
    });
    // update class
    app.put('/updateclass/:id',verifyJWT, verifyinstructor, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedclass = req.body;
      const setupdatedclass = {
        $set: {
          name  : updatedclass.name,
          iName : updatedclass.iName,
          email : updatedclass.email,
          price : updatedclass.price,
          seat  : updatedclass.seat
        },
      };
      const result = await classesCollection.updateOne(filter, setupdatedclass);
      res.send(result);
    });
    // set feedback
    app.patch('/class/feedback/:id/feedback', async (req, res) => {
      const id = req.params.id;
      const feedback = req.body;
      const value = feedback.feedback
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          feedback: value
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // get all classes
    app.get('/allclasses', async (req, res) => {
      const result = await classesCollection.find({ status: 'Approved' }).toArray();
      res.send(result);
    });
    // store data on selected class
    app.post('/selectedclasses', verifyJWT, async (req, res) => {
      const selectedClass = req.body;
      const query = { name: selectedClass.name, email: selectedClass.email }
      const existingClass = await selectedClassesCollection.findOne(query);
      if (existingClass) {
        return res.send({ message: 'Class Already Exist' })
      }
      const result = await selectedClassesCollection.insertOne(selectedClass);
      res.send(result);
    });
    // get selected classes to specific user
    app.get('/selectedclasses', verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (req.decoded.email === email) {
        const query = { email: email }
        const result = await selectedClassesCollection.find(query).toArray();
        res.send(result);
      }
    });
    // delete selected class
    app.delete('/selectedclasses/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedClassesCollection.deleteOne(query);
      res.send(result);
    });

    // payment related api

    // create payment intent
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    });

    // get selected class for payment
    app.get('/payment/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedClassesCollection.findOne(query);
      res.send(result);
    });

    // post payment info
    app.post('/payments', verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);
      const query = { name: payment.className, email: payment.email }
      const deleteResult = await selectedClassesCollection.deleteOne(query)

      res.send({ insertResult, deleteResult });
    });
        // get enroled class
        app.get('/enroledclasses',verifyJWT, async (req, res) => {
          const email = req.query.email;
          if (req.decoded.email === email) {
            const query = { email: email }
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
          }
        });
        // get payment info
        app.get('/paymenthistory',verifyJWT, async (req, res) => {
          const email = req.query.email;
          if (req.decoded.email === email) {
            const query = { email: email }
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
          }
        });


    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Sports School Running');
})

app.listen(port, () => {
  console.log(`Sports School Running On Port ${port}`);
})