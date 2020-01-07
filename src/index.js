const phin = require('phin');

// Get the region dynamically from EC2 Metadata
phin({
	'url': 'http://169.254.169.254/latest/dynamic/instance-identity/document',
	'parse': 'json'
})
.then(metadata => {
  const AWS_REGION = metadata.body.region;

  const AWSXRay = require('aws-xray-sdk');
  AWSXRay.setDaemonAddress(process.env.XRAY_DAEMON_ADDR || 'localhost:2000');

  const AWS = AWSXRay.captureAWS(require('aws-sdk'));
  const xrayExpress = require('aws-xray-sdk-express');

  // Configure AWS region from ENV vars
  AWS.config.update({ region: AWS_REGION });

  const dynamoDBClient = new AWS.DynamoDB({apiVersion: '2012-08-10'});
  const sqsClient = new AWS.SQS({apiVersion: '2012-11-05'});

  const express = require('express')
  const app = express()

  // Constants
  const DDB_TABLE_NAME = 'eks-workshop';
  const SQS_QUEUE_NAME = 'eks-workshop';

  const serverConfig = {
    name: process.env.SERVER_NAME || 'eks-workshop-service',
    port: process.env.SERVER_PORT || 8080,
    host: '0.0.0.0',
  };

  // Routing
  // Open statement before routing
  app.use(xrayExpress.openSegment('defaultName'));

  app.get('/ping', (req, res) => {
    res
      .status(200)
      .send('pong')
  });

  app.get('/', (req, res, next) => {
      getDynamoItem()
      .then(getSQSUrl)
      .then(getSQSMessage)
      .then(() => {
        res
          .status(200)
          .send(`Insert AWESOME web page here! ^_^`);
      })
      .catch(next);
  });

  // Closing statement after routing
  app.use(xrayExpress.closeSegment());

  // Start server
  app.listen(serverConfig.port, serverConfig.host, (err) => {
    if (err) throw err;
    console.log(`${serverConfig.name} running on ${serverConfig.host}:${serverConfig.port}`);
  });

  // Operations
  async function getDynamoItem() {
    let getItemInput = {
      TableName: DDB_TABLE_NAME,
      Key: {
        'id': {S: 'the_magic_of_copperfield'}
      }
    }

    return dynamoDBClient.getItem(getItemInput).promise();
  }

  async function getSQSMessage(queueUrl) {
    let receiveMessageInput = {
      QueueUrl: queueUrl,
      WaitTimeSeconds: 2, // Use long-polling
    }

    return sqsClient.receiveMessage(receiveMessageInput).promise();
  }

  async function getSQSUrl() {
    let getQueueUrlInput = {
      QueueName: SQS_QUEUE_NAME
    }

    return sqsClient.getQueueUrl(getQueueUrlInput).promise()
    .then(data => {
      return data.QueueUrl
    })
  }

})
.catch(console.log);
