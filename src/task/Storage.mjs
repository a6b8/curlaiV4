import { EventEmitter } from 'events'

import { Generator }  from './Generator.mjs'


const Storage = class extends EventEmitter {
    #config
    #state
    #provider
    #generator


    constructor( { storage, feed, provider, credentials, opmlCategories } ) {
        super()
        this.#config = { storage, feed }
        this.#state = { provider, ...credentials, opmlCategories }
        this.#generator = new Generator( { feed } )
    }


    async init() {
        const { provider } = this.#state
        this.#provider = await this.#setProvider( { provider } )
        return true
    }


    async uploadCategories( { feedItemsByCategory } ) { 
        const func = 'uploadCategories'
        this.emit( 'print',  func, 0, {} )

        const { ContentType } = this.#config['feed']['properties']['category']
        const { opmlCategories } = this.#state
        const currentKeys = Object.keys( feedItemsByCategory )

        await Object
            .entries( opmlCategories )
            .reduce( async( accPromise, [ daytime, categories ] ) => {
                const acc = await accPromise
                const uploads = []
                await categories
                    .reduce( async( abbPromise, categoryStruct ) => {
                        const abb = await abbPromise
                        const { name: category } = categoryStruct
                        if( !currentKeys.includes( category ) ) {
                            return abb
                        }

                        const itemArrays = feedItemsByCategory[ category ]
                        const { feedContent: content } = this.#generator
                            .generateCategoryFeed( { category, itemArrays } )
                        const fileName = `${category}.xml`
                        const { status, messages, url } = await this
                            .#uploadData( { content, fileName, ContentType } )
                        uploads.push( { category, 's': status, url } )
                        return abb
                    }, Promise.resolve() )
                if( uploads.length !== 0 ) {
                    this.emit( 'print',  func, 2, { daytime, uploads } )
                }
                return acc
            }, Promise.resolve() )

/*
        const states = []
        await Object
            .entries( itemsByCategory )
            .reduce( async( acc, [ title, itemArrays ] ) => {
                await acc
                const { feedContent } = this.#generator
                    .generateCategoryFeed( { title, itemArrays } )
                const keyName = `${title}.xml`
                const { url } = await this.#uploadData( { 
                    content: feedContent, 
                    keyName, 
                    ContentType: 'application/xml'
                } )
                this.emit( 'print', { 'data': { title, url }, 'func': 'uploadCategories', 'status': '0' } )

            }, Promise.resolve() )
        this.emit( 'print', { 'data': {}, 'func': 'uploadCategories', 'status': '0' } )
*/
        return true
    }

/*
    async start( { itemsByCategory } ) {
        Object
            .entries( itemsByCategory )
            .forEach( ( [ category, items ] ) => {
                const content = JSON.stringify( items, null, 4 )
                const keyName = `${category}.json`
                // this.#uploadData( { content, keyName } )
            } )

        return true
    }
*/

    getFeedUrl( { provider, fileName, subfolder='categories' } ) {
        fileName = fileName.replaceAll( ' ', '_' )
        const providerStruct = this.#config['storage']['providers'][ provider ]
        const subFolderPath =  providerStruct['subfolders'][ subfolder ]
        const { awsS3BucketName, awsS3FolderPath, awsS3Region } = this.#state
        const { ACL } = providerStruct

        switch( provider ) {
            case 's3':
                const folderPath = `${awsS3FolderPath}/${subFolderPath}/${fileName}`
                const publicUrl = `https://${awsS3BucketName}.s3.${awsS3Region}.amazonaws.com/${folderPath}`
                return { folderPath, publicUrl, ACL }
            default:
                console.log( `Get feed url: ${provider} is unknown.` )
                return {}
        }
    }


    async #uploadData( { content, fileName, subfolder='categories', ContentType } ) {
        const { provider } = this.#state

        let status = true
        let messages = []
 
        switch( provider ) {
            case 's3':
                try {
                    const { s3, PutObjectCommand } = this.#provider
                    const { awsS3BucketName: Bucket } = this.#state
                    const { folderPath: Key, publicUrl: url, ACL } = this
                        .getFeedUrl( { provider, fileName, subfolder } )
                    const Body = content
                    const command = new PutObjectCommand( { 
                        Bucket, Key, Body, ContentType, ACL 
                    } )
                    const response = await s3.send( command )
                    return { status, messages, url }
                } catch( err ) {
                    status = false
                    console.error( 'Error uploading file:', err['message'] )
                    return { status, messages, 'url': null }
                }
            default:
                console.log( 'Storage provider not supported.' )
                return { status, messages, 'url': null }
        }
    }


    async #setProvider( { provider } ) {
        switch( provider) {
            case 's3':
                const { awsS3Region, awsS3AccessKeyId, awsS3SecretAccessKey } = this.#state
                const { S3Client, PutObjectCommand } = await import( '@aws-sdk/client-s3' )
                const s3 = new S3Client( {
                    'region': awsS3Region,
                    'credentials': {
                        'accessKeyId': awsS3AccessKeyId,
                        'secretAccessKey': awsS3SecretAccessKey
                    }
                } )
                const struct = { s3, PutObjectCommand }
                return struct
            default:
                console.log( 'Storage provider not supported.' )
                return false
        }
    }
}


export { Storage }