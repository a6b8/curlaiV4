import { EventEmitter } from 'events'

import { Generator } from './Generator.mjs'


const Merger = class extends EventEmitter{
    #config
    #modules
    #state
    #customModules


    constructor( { merger, table, feed } ) {
        super()
        this.#config = { merger, table, feed }
    }


    async init( { customModules }) {
        this.#customModules = customModules
        return true
    }


    async getItemsByCategory( { tableRows } ) {
        this.emit( 'print', 'getItemsByCategory', 0, { tableRows } )

        const { feedItemRequestsByExtension } = await this
            .#prepareFeedItemRequestsByExtension( { tableRows } )
        const { feedItemsByStatus } = await this.#getFeeds( { feedItemRequestsByExtension } )
        const { feedItemsByCategory } = await this.#sortByCategory( { feedItemsByStatus } )

        const { errors } = feedItemsByStatus
        const { notFound } = feedItemRequestsByExtension
        const { columns } = this.#config['table']
 
        const { printableErrors, printableNotFounds } = this
            .#makeRowTableArraysPrintable( { errors, notFound, columns } )
        this.emit( 'print', 'notFound', 1, { printableErrors, printableNotFounds } )

        return { feedItemsByCategory }
    }


    #makeRowTableArraysPrintable( { errors, notFound, columns } ) {
        const printableNotFounds = notFound
            .map( ( rowTableArray ) => {
                const { rowTableObject } = Generator
                    .convertTableRowFromArrayToObject( { rowTableArray, columns } )
                const { 'id': rId, category, 'name': userChannelName, url } = rowTableObject

                return { rId, category, userChannelName, url }
            } )

        const printableErrors = errors
            .map( ( mixedArray ) => {
                const [ rowTableArray, messagesArray ] = mixedArray
                const { rowTableObject } = Generator
                    .convertTableRowFromArrayToObject( { rowTableArray, columns } )
                const { 'id': rId, category, 'name': userChannelName, url } = rowTableObject
                const str = messagesArray.join( ', ' )
                return { rId, category, userChannelName, 'error': str, url }
            } )

        return { printableErrors, printableNotFounds }
    }


    async #sortByCategory( { feedItemsByStatus } ) {
        const { success } = feedItemsByStatus
        const { itemStruct } = this.#config['feed']

        const feedItemsByCategory = success
            .reduce( ( acc, itemArray, index, arr ) => {
                const { itemObject: { feedCategory } } = Generator
                    .convertFeedItemFromArrayToObject( { itemArray, itemStruct } )

                if( !Object.hasOwn( acc, feedCategory ) ) { acc[ feedCategory ] = [] }
                acc[ feedCategory ].push( itemArray )

                if( arr.length - 1 === index ) {
                    // sort items by unixtimestamp
                    acc = Object
                        .entries( acc )
                        .reduce( ( acc, [ key, value ] ) => {
                            const sorted = value
                                .sort( ( a, b ) => {
                                    const { itemObject: { unixTimestamp: aTimestamp } } = Generator
                                        .convertFeedItemFromArrayToObject( { itemArray: a, itemStruct } )
                                    const { itemObject: { unixTimestamp: bTimestamp } } = Generator
                                        .convertFeedItemFromArrayToObject( { itemArray: b, itemStruct } )

                                    return bTimestamp - aTimestamp
                                } )
                            acc[ key ] = sorted
                            return acc
                        }, {} )
                }   

                return acc
            }, {} )

        return { feedItemsByCategory }
    }



    async #getFeeds( { feedItemRequestsByExtension } ) {
        const funcName = 'getFeeds'

        const all = await Promise.all(
            Object
                .keys( feedItemRequestsByExtension )
                .map( async( extensionId ) => {
                    if( extensionId === 'notFound' ) { 
                        const struct = { 
                            extensionId, 
                            'resultsByExtension': { 
                                'success': [], 
                                'errors': [], 
                                'unused': [] 
                            } 
                        }

                        const n = [
                            { extensionId, type: 'unused', 'value': feedItemRequestsByExtension[ extensionId ].length },
                            { extensionId, type: 'status', 'value': 'finished' }
                        ]
                            .forEach( data => { this.emit( 'print', funcName, 1, data ) } )

                        return struct
                    } else {
                        const rowTableArrays = feedItemRequestsByExtension[ extensionId ]
                        const { resultsByExtension } = await this
                            .#getFeedsByExtension( { extensionId, rowTableArrays, funcName } )
                        return { extensionId, resultsByExtension }
                    }
                } )
        )

        const feedItemsByStatus = all
            .reduce( ( acc, a ) => {
                const { success, errors, unused } = a['resultsByExtension']

                acc['success'].push( ...success )
                acc['errors'].push( ...errors )
                acc['unused'].push( ...unused )
                return acc
            }, { 'success': [], 'errors': [], 'unused': [] } )

        return { feedItemsByStatus }
    }


    async #getFeedsByExtension( { extensionId, rowTableArrays, funcName } ) {
        function findPenalty( { penalties, currentPenalty } ) {
            // console.log( 'HERE', currentPenalty )
            const penalty = penalties
                .reduce( ( acc, a ) => {
                    const { range, delay, cancel } = a
                    let test = false
                    if( range.length === 1 ) {
                        test = range[ 0 ] === currentPenalty
                    } else if( range.length === 2 ) {
                        const [ from, to ] = range
                        test = 
                            currentPenalty >= from &&
                            currentPenalty <= to
                    }
                    if( test ) { 
                        const _new =  { delay, cancel } 
                        acc = _new
                    }

                    return acc
                }, { 'delay': 0, 'cancel': false } )

            return penalty
        }

        const { columns } = this.#config['table']
        const { itemStruct } = this.#config['feed']
        const { maxSameRequests, penalties, defaultDelay } = this.#customModules
            .getPlugin( { extensionId } )['config']
        const extensionState = {
            'index': 0,
            'currentDelay': defaultDelay,
            'currentPenalty': 0,
            'runExtension': true
        }

        const concurrentRequests = new Array( maxSameRequests )
            .fill( null )
        const all = await Promise.all(
            concurrentRequests
                .map( async( _, agentId ) => {
                    const success = []
                    const errors = []
                    const unused = []

                    while( rowTableArrays.length > 0 && extensionState['runExtension'] ) {
                        extensionState['index']++
                        const rowTableArray = rowTableArrays.shift()

                        const { rowTableObject } = Generator
                            .convertTableRowFromArrayToObject( { rowTableArray, columns } )
                        const { id: rId, url, name: userChannelName, category: feedCategory } = rowTableObject

                        // const [ rId, url, userChannelName, feedCategory,, ] = rowTableArray
/*
                        const { status, messages, results } = await this.#state['plugins']
                            .get( extensionId )['extension']
                            .getFeed( { url, userChannelName, feedCategory } )
*/
                        const { status, messages, results } = await this.#customModules
                            .getPlugin( { extensionId } )['extension']
                            .getFeed( { url, userChannelName, feedCategory } )

                        // const item = { extensionId, agentId, request, 'extension': { status, messages, results } }

                        if( !status ) {
                            // const item = [ ...results ]
                            // const item = { rId, extensionId, userChannelName, url }
                            // console.log( item )
                            errors.push( [ rowTableArray, messages ] )
                            this.emit( 'print', funcName, 1, { extensionId, 'type': 'errors' } )

                            extensionState['currentPenalty'] += 1
                            const { currentPenalty } = extensionState
                            const { delay, cancel } = findPenalty( { penalties, currentPenalty } )
                            extensionState['currentDelay'] = delay
                            if( cancel ) {
                                extensionState['runExtension'] = false
                                break
                            }
                        } else {
                            const itemArrays = results
                                .map( itemObject => {
                                    const { headline } = this.#getItemHeadline( { itemObject } )
                                    itemObject = { ...itemObject, headline }
                                    const { itemArray } = Generator
                                        .convertFeedItemFromObjectToArray( { itemObject, itemStruct } )
                                    return itemArray
                                } )
                            success.push( ...itemArrays )
                            this.emit( 'print', funcName, 1, { extensionId, type: 'success' } )
                        }

                        await new Promise( resolve => setTimeout( resolve, extensionState['currentDelay'] ) )
                    }

                    unused.push( ...rowTableArrays.map( request => request[ 0 ] ) )

                    const n = [
                        { extensionId, 'type': 'unused', 'value': rowTableArrays.length },
                        { extensionId, 'type': 'status', 'value': 'finished' }
                    ]
                        .forEach( data => {
                            this.emit( 'print', funcName, 1, data )
                        } )

                    return { success, errors, unused }
                } )
        )

        const resultsByExtension = all
            .reduce( ( acc, a, index, arr ) => {
                const { success, errors, unused } = a
                // success expects an array of arrays
                acc['success'].push( ...success )
                acc['errors'].push( ...errors )
                acc['unused'].push( ...unused )

                if( index === arr.length - 1 ) {
                    const unused = rowTableArrays
                        .map( ( rowTableArray ) => {
                            const struct = { 
                                'agentId': null, 
                                rowTableArray, 
                                'extension': { 
                                    'status': false, 
                                    'messages': 'Extension was cancelled', 
                                    'result': null 
                                } 
                            }

                            return struct
                        } )

                    // acc['unused'].push( ...unused['results'] )
                }

                return acc
            }, { 'success': [], 'errors': [], 'unused': [] } )

        return { resultsByExtension }
    }


    async #prepareFeedItemRequestsByExtension( { tableRows } ) {
        const { columns, statusTypes } = this.#config['table']
        const { ok } = statusTypes

        const statusId = columns
            .findIndex( ( [ key,, ] ) => key === 'status' )

        const feedItemRequestsByExtension = tableRows
            .filter( rowTableArray => rowTableArray[ statusId ] === ok )
            .reduce( ( acc, rowTableArray ) => {
                const { rowTableObject } = Generator
                    .convertTableRowFromArrayToObject( { rowTableArray, columns } )
                const { url } = rowTableObject
                const match = this.#customModules
                    .findPluginRegexFromUrl( { url } )

                if( match === undefined ) { 
                    acc['notFound'].push( rowTableArray )
                    return acc 
                }
                const [ ,id ] = match

                if( !Object.hasOwn( acc, id ) ) { acc[ id ] = [] }
                acc[ id ].push( rowTableArray )

                return acc
            }, { 'notFound': [] } )

        return { feedItemRequestsByExtension }
    }

/*
    async #addModules( { moduleFolderPath } ) {
        const { extension } = this.#config['merger']['customFolder']['subfolders']
        const p = `${moduleFolderPath}${extension}`

        const targetPath = path.resolve( process.cwd(), p )
        const files = fs.readdirSync( targetPath )
        const modules = files
            .filter( file => path.extname( file ) === '.mjs' )
            .map( file => `${targetPath}/${file}` )

        const loadedModules = await Promise.all(
            modules
                .map( async( p ) => {
                    let status = true
                    let messages = []
                    let _module = null

                    try {
                        _module = await import( p )
                    } catch( e ) {
                        status = false
                        messages.push( `Error loading module: ${p}` )
                        return { status, messages, 'id': null, 'regexs': null, 'credentials': null, 'Extension': null }
                    }

                    const { Extension } = _module
                    const { id, regexs, requestedCredentials } = Extension.getConfig()
                    const { status: s, messages: m, credentials } = this
                        .#getModuleCredentials( { id, requestedCredentials } )
                    status = s && status
                    messages.push( ...m )
                    return { status, messages, id, regexs, credentials, Extension }
                } )
        )

        if( !loadedModules.every( a => a['status'] ) ) {
            loadedModules
                .filter( a => !a['status'] )
                .forEach( a => console.log( a['messages'] ) )
            process.exit( 1 )
        }

        await Promise.all(
            loadedModules
                .map( async( { id, regexs, credentials, Extension } ) => {
                    const extension = new Extension()
                    const config = Extension.getConfig()
                    this.#state['plugins'].set( id, { extension, config } )
                    await this.#state['plugins'].get( id )['extension'].init( { credentials } )
                    regexs.forEach( ( regex ) => { this.#state['regexs'].push( [ regex, id ] ) } )
                    return true
                } )
        )

        return true
    }
*/

    #healthCheck() {
        return true
    }

/*
    #getModuleCredentials( { id, requestedCredentials } ) {
        const availableKeys = Object.keys( this.#config['moduleCredentials'] )

        let status = false
        let messages = []
        const credentials = requestedCredentials
            .reduce( ( acc, { key }, index ) => {
                if( key === 'processCwd' ) {
                    acc[ key ] = process.cwd()
                } else if( availableKeys.includes( key ) ) {
                    if( !Object.hasOwn( this.#config['moduleCredentials'], key ) ) {
                        status = false
                        messages.push( `${id}: Requested credential ${key} is not available.` )
                    }
                    acc[ key ] = this.#config['moduleCredentials'][ key ]
                    status = true
                } else {
                    status = false
                    messages.push( `${id}: Requested credential ${key} is not available.` )
                }

                return acc
            }, {} )
        
        return { status, messages, credentials }
    }
*/

    #getItemHeadline( { itemObject } ) {
        const { current } = this.#config['feed']['headlines']
        const { splitter, more, elements } = this.#config['feed']['headlines'][ current ]
        const { funcs } = this.#config['feed']

        const headline = elements
            .map( ( element, ) => {
                const { key, modifiers } = element
                const value = modifiers
                    .reduce( ( acc, [ funcKey, params ] ) => {
                        const func = funcs[ funcKey ]
                        acc = func( acc, params, itemObject )
                        return acc
                    }, itemObject[ key ] )
                return value
            }  )
            .join( splitter )

        return { headline }
    }
}


export { Merger }