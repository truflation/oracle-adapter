const express = require('express')
const bodyParser = require('body-parser')
const { Requester, Validator } = require('@chainlink/external-adapter')

const app = express()
const port = process.env.EA_PORT || 8081

app.use(bodyParser.json())

app.post('/', (req, res) => {
  console.log('POST Data: ', req.body)
  createRequest(req.body, (status, result) => {
    console.log('Result: ', result)
    res.status(status).json(result)
  })
})

app.listen(port, () => console.log(`Listening on port ${port}!`))

function createRequest (input, callback) {
  const validator = new Validator(callback, input)
  const jobRunID = validator.validated.id
  const url = 'https://api.truflation.com/current/'

  Requester.request(
    { url },
    data => {
      if (
        'currentInflationIndex' in data &&
        'yearAgoInflationIndex' in data &&
        'yearOverYearInflation' in data
      ) {
        return false
      }
      return true
    }
  )
    .then(response => {
      const value = JSON.parse(JSON.stringify(response.data))
      response.data.result = Requester.getResult(value, [])
      callback(response.status, Requester.success(jobRunID, response))
    })
    .catch(error => {
      callback(500, Requester.errored(jobRunID, error))
    })
}

// GCP Functions
exports.gcpservice = (req, res) => {
  createRequest(req.body, (statusCode, data) => {
    res.status(statusCode).send(data)
  })
}

// AWS Lambda
exports.handler = (event, context, callback) => {
  createRequest(event, (statusCode, data) => {
    callback(null, data)
  })
}

// newer AWS Lambda implementations
exports.handlerv2 = (event, context, callback) => {
  createRequest(JSON.parse(event.body), (statusCode, data) => {
    callback(null, {
      statusCode: statusCode,
      body: JSON.stringify(data),
      isBase64Encoded: false
    })
  })
}
