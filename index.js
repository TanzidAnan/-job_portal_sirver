require('dotenv').config()
const express = require('express');
const jwt = require('jsonwebtoken');
const cookeParser=require('cookie-parser')
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(express.json())
app.use(cors({
    origin:('http://localhost:5173'),
    credentials:true
}))
app.use(cookeParser())


const logger=(req,res,next) =>{
    console.log('next logger');
    next()
}

const verifyToken=(req,res,next) =>{
    console.log('verify token ',req.cookies);
    const token =req?.cookies?.token;
    if(!token){
        return res.status(401).send({message:'Unauthoraize token'})
    }
    jwt.verify(token,process.env.JWT_SECRET,(err,decode) =>{
        if(err){
            return res.status(401).send({message:'Unauthorized token'})
        }
        req.user =decode;
        next()
    })
   
}



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.e72gk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();


        const jobsCollection = client.db("jobPortal").collection("jobs");
        const jobsApplicationCollection = client.db("jobPortal").collection("job_application");


        app.post('/jwt',async(req,res) =>{
          const user =req.body;
          const token =jwt.sign(user,process.env.JWT_SECRET,{expiresIn:'1h'});
          res
          .cookie('token',token,{
            httpOnly:true,
            secure:false
          })
          .send({success:true})
        })

        app.get('/jobs', async (req, res) => {

            const email =req.query.email;
            let query ={}
            if(email){
                query={hr_email:email}
            }

            const cursor = jobsCollection.find(query);
            const result =await cursor.toArray();
            res.send(result)
        })
        app.get('/jobs/:id',async(req,res) =>{
            const id =req.params.id;
            const query ={_id:new ObjectId(id)}
            const result =await jobsCollection.findOne(query);
            res.send(result)
        })

        app.post('/jobs',async(req,res) =>{
            const newjobs =req.body;
            const result =await jobsCollection.insertOne(newjobs);
            res.send(result)
        })

        app.get('/job_application/jobs/:job_id',async(req,res) =>{
            const jobId =req.params.job_id
            const query ={job_id:jobId};
            const result =await jobsApplicationCollection.find(query).toArray();
            res.send(result)
        })

        app.get('/job_application',verifyToken,async(req,res) =>{
            const email =req.query.email;
            const query ={applicent_email:email};
            if(req.user.email !== req.query.email){
                return res.status(401).send({message:'forbidden access'})
            }
            const result =await jobsApplicationCollection.find(query).toArray();
            for(const application of result){
                console.log(application.job_id);
                const query1 ={_id: new ObjectId(application.job_id)};
                const job =await jobsCollection.findOne(query1);
                if(job){
                    application.title =job.title
                    application.company=job.company
                    application.company_logo=job.company_logo
                }
            }
            res.send(result)
        })

        app.post('/job_application',async(req,res) =>{
            const application =req.body;
            const result =await jobsApplicationCollection.insertOne(application);
            const id =application.job_id;
            const query ={_id:new ObjectId(id)}
            const job = await jobsCollection.findOne(query);
            let newCount =0
            if(job.applicationCount){
                newCount =job.applicationCount +1
            }
            else{
                newCount=1
            }
            const filter ={_id:new ObjectId(id)}
            const updateDoc ={
                $set:{
                    applicationCount:newCount
                }
            }
            const updateResult =await jobsCollection.updateOne(filter,updateDoc)
            console.log(job)
            res.send(result)

        })
        app.patch('/job_application/:id',async(req,res) =>{
            const id =req.params.id;
            const data =req.body;
            const filter ={_id:new ObjectId(id)}
            const updateDoc={
                $set:{
                    status:data.status
                }
            }
            const result =await jobsApplicationCollection.updateOne(filter,updateDoc);
            res.send(result)
        })



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
    res.send('job is finlay seiver')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})