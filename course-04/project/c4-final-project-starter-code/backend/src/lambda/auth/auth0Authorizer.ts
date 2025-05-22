import { CustomAuthorizerEvent, CustomAuthorizerResult } from 'aws-lambda'
import 'source-map-support/register'

import { verify, decode } from 'jsonwebtoken'
import { createLogger } from '../../utils/logger'
import Axios from 'axios'
import { Jwt } from '../../auth/Jwt'
import { JwtPayload } from '../../auth/JwtPayload'
import { promisify } from 'util'


const logger = createLogger('auth')

// TODO: Provide a URL that can be used to download a certificate that can be used
// to verify JWT token signature.
// To get this URL you need to go to an Auth0 page -> Show Advanced Settings -> Endpoints -> JSON Web Key Set
const jwksUrl = 'https://dev-b58ldaey.us.auth0.com/.well-known/jwks.json'

const certCache: { [key: string]: string } = {}

export const handler = async (
  event: CustomAuthorizerEvent
): Promise<CustomAuthorizerResult> => {
  logger.info('Authorizing a user', event.authorizationToken)
  try {
    const jwtToken = await verifyToken(event.authorizationToken)
    logger.info('User was authorized', jwtToken)

    return {
      principalId: jwtToken.sub,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: '*'
          }
        ]
      }
    }
  } catch (e) {
    logger.error('User not authorized', { error: e.message })

    return {
      principalId: 'user',
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Deny',
            Resource: '*'
          }
        ]
      }
    }
  }
}



async function getSigningKey(jwt: Jwt): Promise<string> {
  const header = jwt.header
  const kid = header.kid

  if (!kid) {
    logger.error('No kid found in token header')
    throw new Error('No kid found in token header')
  }

  // Check if certificate is already cached
  if (certCache[kid]) {
    logger.info('Using cached certificate')
    return certCache[kid]
  }

  logger.info(`Fetching signing key for kid: ${kid}`)

  try {
    // Fetch the JWKS from Auth0
    const response = await Axios.get(jwksUrl)
    const jwks = response.data

    // Find the signing key with matching kid
    const signingKeys = jwks.keys.filter(
      (key: any) =>
        key.use === 'sig' && // JWK property `use` determines the JWK is for signature verification
        key.kty === 'RSA' && // We are only supporting RSA (RS256)
        key.kid === kid &&   // The `kid` must be present to be useful for later
        key.x5c && key.x5c.length // Has useful public keys
    )

    if (!signingKeys.length) {
      logger.error(`No signing keys found for kid: ${kid}`)
      throw new Error('No signing keys found')
    }

    // Construct the certificate
    const signingKey = signingKeys[0]
    const x5c = signingKey.x5c[0] // We are only using the first x5c entry
    const cert = `-----BEGIN CERTIFICATE-----\n${x5c}\n-----END CERTIFICATE-----`

    // Cache the certificate
    certCache[kid] = cert

    logger.info('Successfully retrieved and cached signing key')
    return cert
  } catch (error) {
    logger.error('Failed to get signing key:', error)
    throw new Error('Failed to get signing key')
  }
}

async function verifyToken(authHeader: string): Promise<JwtPayload> {
  const token = getToken(authHeader)
  const jwt: Jwt = decode(token, { complete: true }) as Jwt

  if (!jwt) {
    logger.error('Invalid token')
    throw new Error('Invalid token')
  }

  // TODO: Implement token verification
  // You should implement it similarly to how it was implemented for the exercise for the lesson 5
  // You can read more about how to do this here: https://auth0.com/blog/navigating-rs256-and-jwks/

  try {
    const signingKey = await getSigningKey(jwt)

    const decoded = await new Promise<JwtPayload>((resolve, reject) => {
      verify(token, signingKey, { algorithms: ['RS256'] }, (err, payload) => {
        if (err) {
          reject(err)
        } else {
          resolve(payload as JwtPayload)
        }
      })
    })

    logger.info('Token verified successfully')
    return decoded
  } catch (error) {
    logger.error('Token verification failed:', error)
    throw new Error('Token verification failed')
  }
}

function getToken(authHeader: string): string {
  if (!authHeader) throw new Error('No authentication header')

  if (!authHeader.toLowerCase().startsWith('bearer '))
    throw new Error('Invalid authentication header')

  const split = authHeader.split(' ')
  const token = split[1]

  return token
}
