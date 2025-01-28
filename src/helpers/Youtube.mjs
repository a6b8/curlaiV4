import { google } from 'googleapis'

import fs from 'fs'
import http from 'http'

import { Generator } from './../task/Generator.mjs'


class Youtube {
    #state
    #config
 
    #oauth2Client
    #youtube


    constructor( { clientId, clientSecret, serverPort=3000, tokenPath, youtube, table } ) {
        this.#config = { youtube, table }

        this.#state = {
            clientId,
            clientSecret,
            'redirectUri': `http://localhost:${serverPort}/callback`,
            serverPort,
            tokenPath
        }

        return true
    }


    async init() {
        const { clientId, clientSecret, redirectUri } = this.#state
        this.#oauth2Client = await this.#addOauthClient( { clientId, clientSecret, redirectUri } )
        this.#youtube = google.youtube( { version: 'v3', 'auth': this.#oauth2Client } )

        return true
    }


    async getLikedVideos( { maxResultsTotal=100 } ) {
        const { likedVideos: payload } = this.#config['youtube']['payloads']

        let running = true
        const results = []

        let nextPageToken = null
        do {
            const { status, messages, result } = await this.getData( { payload } )
            if( !status ) { running = false; return [] }

            const { items, nextPageToken: npt } = result
            results.push( ...items )
            nextPageToken = npt
            payload['pageToken'] = nextPageToken
            if( ( results.length + 1 ) >= maxResultsTotal ) { running = false }
        } while( nextPageToken && running )

        return { results }
    }


    async getData( { payload } ) {
        const struct = {
            'status': false,
            'messages': [],
            'result': { 'items': [], 'nextPageToken': null }
        }

        try {
            const response = await this.#youtube.playlistItems
                .list( payload )
            const { status, data } = response
            if( status !== 200 ) {
                messages.push( `Error fetching data: ${status}` )
                return struct
            }

            const items = data['items']
                .filter( ( item ) => item['snippet']['title'] !== 'Deleted video' )
                .map( ( item ) => {
                    const { snippet } = item
                    const { videoOwnerChannelId: channelId, videoOwnerChannelTitle: channelName, title, publishedAt } = snippet
                    const { videoId } = snippet['resourceId']
                    return { channelId, channelName, title, videoId, publishedAt }
                } )
            const { nextPageToken } = data

            struct['status'] = true
            struct['result'] = { items, nextPageToken }
            return struct
        } catch( e ) {
            messages.push( `An error occured: ${e}` )
            return struct
        }   
    }


    async getNewChannelFromLikedVideos( { validTableRows, maxResultsTotal=1000 } ) {
        const { columns, statusTypes } = this.#config['table']
        const { ok } = statusTypes
        const { filt } = this.#config['youtube']

        const currentChannelIds = validTableRows
            .map( ( rowTableArray ) => {
                const { rowTableObject } = Generator
                    .convertTableRowFromArrayToObject( { rowTableArray, columns } )
                const { url } = rowTableObject
                return url
            } )
            .filter( ( url ) => url.startsWith( filt ) )
            .map( ( url ) => url.split( '=' ).at( -1 ) )
            .reduce( ( acc, channelId, index ) => {
                acc.add( channelId )
                return acc
            }, new Set() )

        const { results } = await this
            .getLikedVideos( { maxResultsTotal } )

        const data = results
            .reduce( ( acc, likedVideo, index ) => {
                const { channelId, channelName } = likedVideo
                if( currentChannelIds.has( channelId ) ) { return acc }
                if( Object.hasOwn( acc, channelId ) ) { return acc }
                if( channelId === undefined ) { return acc }
                const url = `${filt}${channelId}`
                acc.push( [ url, channelName, 'new', ok, '' ] )
                return acc
            }, [] ) 

        const tsv = data
            .map( ( a ) => a.join( "\t" ) )
            .join( "\n" ) 

        return { tsv, data }
    }




    async #getLikedVideos() {
        let nextPageToken = null;
        const allVideos = [];

        do {
            const response = await this.#youtube.playlistItems.list( {
                part: 'snippet',
                playlistId: 'LL',
                maxResults: 50,
                pageToken: nextPageToken,
            } )

            const videos = response.data.items.map((item) => ({
                title: item.snippet.title,
                videoId: item.snippet.resourceId.videoId,
            }));

            allVideos.push(...videos);
            nextPageToken = response.data.nextPageToken;
        } while (nextPageToken);

        return allVideos;
    }


    async #addOauthClient( { clientId, clientSecret, redirectUri } ) {
        const auth = new google.auth
            .OAuth2( clientId, clientSecret, redirectUri )
        const { status, messages, 'result': credentials } = await this.#getToken( { auth } )
        auth.setCredentials( credentials )

        return auth
    }


    async #getToken( { auth }) {
        const { tokenPath } = this.#state
        const { status: s1, messages: m1, result: r1 } = this.#getLocalSavedToken()
        m1.push( 'Token retrieved from local storage' )
        if( s1 ) { return { 'status': s1, 'messages': m1, 'result': r1 } }
        const { oauthParams } = this.#config['youtube']
        const authUrl = auth.generateAuthUrl( oauthParams )
        console.log( 'Authorize this app by visiting this URL:', authUrl )
        const { status: s2, messages: m2, result: r2 } = await this.#getNewToken( { auth } )
        m2.push( 'Token retrieved from OAuth2' )
        if( s2 ) { 
            fs.writeFileSync( tokenPath, JSON.stringify( r2 ) )
            m2.push( `Saved Token to local storage: ${tokenPath}` )
        }

        return { 'status': s2, 'messages': m2, 'result': r2 }
    }


    async #getNewToken( { auth }) {
        let status = false
        let messages = []
        let result = null

        return new Promise( ( resolve, reject ) => {
            const { serverPort, redirectUri } = this.#state
            const root = `http://localhost:${serverPort}`

            const server = http.createServer( async( req, res ) => {
                if( req.url.startsWith( '/callback' ) ) {
                    const urlParams = new URL( req.url, root ).searchParams
                    const code = urlParams.get( 'code' )
                    try {
                        const { tokens } = await auth.getToken( code )
                        server.close()
                        status = true
                        res.end( 'Success' )
                        resolve( { status, messages, 'result': tokens } )
                    } catch( error ) {
                        const msg = `Error retrieving access token: ${error}`
                        res.end( msg )
                        messages.push( msg )
                        server.close()
                        reject( { status, messages, 'result': tokens } )
                    }
                } else {
                    res.statusCode = 404
                    res.end( 'Not Found' )
                    reject( { status, messages, 'result': tokens } )
                }
            } )

            server.listen( serverPort, () => {
                // console.log( `Listening for OAuth2 callback on ${redirectUri}` )
            } )
        } )
    }


    #getLocalSavedToken() {
        const struct = {
            'status': false,
            'messages': [],
            'result': null
        }

        try {
            const { tokenPath } = this.#state
            const raw = fs.readFileSync( tokenPath, 'utf-8' )
            const json = JSON.parse( raw )
            const now = new Date().getTime() - 1000
            const { expiry_date } = json
            if( expiry_date < now ) {
                struct['messages'].push( 'Token expired' )
                return struct
            } else {
                struct['status'] = true
                struct['result'] = json
                return struct
            }
        } catch( e ) {
            struct['messages'].push( `An error occured: ${e}` )
            return struct
        }
    }
}

export { Youtube }