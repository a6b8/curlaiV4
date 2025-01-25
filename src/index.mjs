import { CustomModules } from './task/CustomModules.mjs'
import { Table } from './task/Table.mjs'
import { Merger } from './task/Merger.mjs'
import { Storage } from './task/Storage.mjs'
import { Print } from './task/Print.mjs'


const RssMerger = class {
    #config
    // #state
    #table
    #merger
    #storage
    #print


    constructor( { config } ) {
        this.#config = config
        return true
    }


   async init( { tableCredentials, storageCredentials, moduleFolderPath, moduleCredentials={} } ) {
        const { custom, table, merger, storage, feed, print: pr } = this.#config

        const customModules = new CustomModules( { custom } )
        const { opmlCategories, validCategories } = await customModules
            .init( { moduleFolderPath, moduleCredentials } )

        {
            const { provider, credentials } = tableCredentials
            this.#table = new Table( { table, provider, credentials, validCategories } )
            await this.#table.init()
        }

        {
            this.#merger = new Merger( { merger, table, feed, moduleCredentials } )
            await this.#merger.init( { moduleFolderPath, customModules } )
        }

        {
            const { provider, credentials } = storageCredentials
            this.#storage = new Storage( { storage, feed, provider, credentials, opmlCategories } )
            await this.#storage.init()
        }

        this.#print = new Print( { 'print': pr } )
        this.#addTableEvents()
        this.#addMergerEvents()
        this.#addStorageEvents()

        return true
    }


    async start() {
        const { status, messages, tableRows } = await this.#table.getTableRows()
        if( !status ) { process.exit( 1 ) }
        const { validTableRows, invalidTableRows } = this.#table
            .sortTableByValidAndInvalidCategories( { tableRows } )

        const { feedItemsByCategory } = await this.#merger
            .getItemsByCategory( { 'tableRows': validTableRows } )


/*
        // const { categoryFeeds } = await this.#generator.generateCategoryFeeds( { itemsByCategory } )
*/

        const result = await this.#storage
            .uploadCategories( { feedItemsByCategory } )

/*
        // await this.#storage.uploadData( { content: 'testting 123', keyName: 'rss.xml' } )
*/
        return true
    }


    async createOpmls( { provider, credentials, moduleFolderPath, subfolder='categories', outputPath='./' } ) {
        const { Generator } = await import( './task/Generator.mjs' )
        const { storage, custom, feed } = this.#config

        const customModules = new CustomModules( { custom } )
        const { opmlCategories } = await customModules
            .init( { moduleFolderPath, 'onlyOpml': true } )

        const st = new Storage( { storage, feed, provider, credentials, opmlCategories } )
        await st.init()

        const generator = new Generator( { feed } )
        const opmlContents = Object
            .entries( opmlCategories )
            .reduce( ( acc, [ name, items ], index ) => {
                const selectionCategory = items
                    .map( ( { name } ) => {
                        const fileName = `${name}.xml`
                        const { publicUrl: url } = st
                            .getFeedUrl( { provider, fileName, subfolder } )
                        const result = { 'title': name, url }
                        return result
                    } )
                const { opmlContent } = generator
                    .generateOpmlFeed( { selectionCategory, name } )
                acc.push( { name, opmlContent } )

                return acc
            }, [] )

        return { opmlContents }
    }


    #addTableEvents() {
        this.#table.on( 
            'print', 
            ( func, level, data ) => { 
                if( func === 'getTableRow' && level === 0 ) {
                    console.log()
                    process.stdout.write( 'Download table...' )
                } else if( func === 'getTableRow' && level === 1 ) {
                    const { messages } = data
                    process.stdout.write( ' failed!' )
                    console.log() 
                    messages.forEach( message => console.error( '- ', message ) ) 
                } else if( func === 'getTableRow' && level === 2 ) {
                    const { tableUrl } = data
                    // process.stdout.write( ' success!' )
                    console.log()
                    console.log( 'Table downloaded from:', tableUrl )
                    console.log()
                } else if( func === 'invalidCategories' && level === 1 ) {
                    const { printableInvalids } = data
                    console.log()
                    console.error( `Row${printableInvalids.length > 1 ? "s": ""} with unknown categories (ignored):` )
                    console.table( printableInvalids )
                } else {
                    console.log( `Table: Unknown event: func: "${func}", level: "${level}".` )
                }
            } 
        )

        return true
    }


    #addMergerEvents() {
        this.#merger.on(
            'print',
            ( func, level, data ) => {
                if( func === 'getItemsByCategory' && level === 0 ) {
                    const { tableRows } = data
                    console.log()
                    console.log( `Start downloading ${tableRows.length} Feeds...` )
                } else if( func === 'getFeeds' && level === 1 ) {
                    this.#print.updateState( data ) 
                    this.#print.print()
                } else if( func === 'notFound' && level === 1 ) {
                    const { printableErrors, printableNotFounds } = data
                    console.log()
                    console.error( `Following url${printableNotFounds.length > 1 ? "s" : ""} do not have an extension:` )
                    console.table( printableNotFounds )
                    console.log()
                    console.error( `Following error${printableErrors.length > 1 ? "s" : ""} occured:` )
                    console.table( printableErrors )
                } else {
                    console.log( `Merger: Unknown event: func: "${func}", level: "${level}".` )
                }
            }
        )
    }


    #addStorageEvents() {
        this.#storage.on( 
            'print', 
            ( func, level, data ) => { 
                if( func === 'uploadCategories' && level === 0 ) {
                    console.log()
                    console.log( `Upload category feeds...` )
                }  else if( func === 'uploadCategories' && level === 2 ) {
                    const { uploads, daytime } = data
                    console.log()
                    console.log( `Upload finished at ${daytime}` )
                    console.table( uploads )
                } else {
                    console.log( `Storage: Unknown event: func: "${func}", level: "${level}".` )
                }
            }
        )    
    }
 
/*
    #addMergerEvents() {
        this.#merger.on( 
            'print', 
            ( { data, func, status } ) => {
                if( func === 'start' && status === '0' ) {
                    console.log()
                    console.log( 'Download feeds...' )
                    const { print } = this.#config
                    this.#print = new Print( { print, 'tableName': 'merger' } )
                } else if( func === 'start' && status === '1' ) {
                    this.#print.updateState( data ) 
                    this.#print.print()
                } else if( func === 'start' && status === '2' ) {
                    const { errors, notFound } = data
                    if( errors.length !== 0 ) {
                        console.log()
                        console.log( `Following error${errors.length > 1 ? "s" : ""} occured:` )
                        console.table( errors )
                        console.log()
                    }

                    if( notFound.length !== 0 ) {  
                        console.log()
                        console.log( `Following url${notFound.length > 1 ? "s" : ""} do not have an extension` )
                        console.table( notFound )
                        console.log()
                    }
                }  else {
                    console.log( `Merger: Unknown event: func: "${func}", status: "${status}".` )
                }
            } 
        )

        return true
    }
*/


/*
    #addStorageEvents() {
        this.#storage.on( 
            'print', 
            ( { data, func, status } ) => { 
                if( func === 'uploadCategories' && status === '0' ) {
                    console.log( 'Upload to Storage HERE', func, status )
                } else if( func === 'uploadCategories' && status === '1' ) {
                    const { category } = data
                    console.log( `${category}` )
                } else if( func === 'uploadCategories' && status === '2' ) {
                    const { title, url } = data
                    console.log( `- ${title} - ${url}` )
                } else {
                    console.log( `Storage: Unknown event: func: "${func}", status: "${status}".` )
                }
            } 
        )

        return true
    }
*/
}


export { RssMerger }