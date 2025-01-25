import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

import { modifyPath } from './../helpers/utils.mjs'


const CustomModules = class {
    #config
    #state


    constructor( { custom } ) {
        this.#config = { custom }

        return true
    }


    async init( { moduleFolderPath, moduleCredentials={}, onlyOpml=false } ) {
        this.#state = {
            'pluginModules': null,
            'pluginRegexs': null,
            moduleFolderPath,
            moduleCredentials
        }

        const targetPath = modifyPath( { 'path': moduleFolderPath } )

/*
        const targetPath = path.resolve( 
            process.cwd(), 
            moduleFolderPath 
        )
*/

        const { opmlCategories, validCategories } = await this
            .#getOpmlCategories( { targetPath } )
        if( onlyOpml ) { return { opmlCategories, validCategories } }

        const { pluginModules, pluginRegexs } = await this
            .#addModules( { targetPath } ) 
        this.#state['pluginModules'] = pluginModules
        this.#state['pluginRegexs'] = pluginRegexs

        return { opmlCategories, validCategories }
    }


    getPlugin( { extensionId } ) {
        return this.#state['pluginModules'].get( extensionId )
    }


    findPluginRegexFromUrl( { url } ) {
        const { pluginRegexs } = this.#state
        const match = pluginRegexs
            .find( ( [ regex, ] ) => regex.test( url ) )
        return match
    }


    async #getOpmlCategories( { targetPath } ) {
        const { file } = this.#config['custom']['folder']['category']
        const p = `${targetPath}/${file}`
        const { opmlCategories } = await import( p )

        const validCategories = Object
            .entries( opmlCategories )
            .reduce( ( acc, a, index, arr ) => {
                const [ key, values ] = a
                Object
                    .entries( values )
                    .forEach( ( b ) => {
                        const [ k, v ] = b
                        const { name } = v 
                        acc.add( name )
                    } )

                if( index === arr.length - 1 ) { 
                    acc = Array.from( acc )
                }

                return acc
            }, new Set() )

        return { opmlCategories, validCategories }
    }


    async #addModules( { targetPath } ) {
        const { extension } = this.#config['custom']['folder']['subfolders']
        const p = `${targetPath}/${extension}`

        const pluginModules = new Map()
        const pluginRegexs = []

        const files = fs.readdirSync( p )
        const modules = files
            .filter( file => path.extname( file ) === '.mjs' )
            .map( file => `${p}/${file}` )

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
                    pluginModules.set( id, { extension, config } )
                    await pluginModules.get( id )['extension'].init( { credentials } )
                    regexs.forEach( ( regex ) => { pluginRegexs.push( [ regex, id ] ) } )
                    return true
                } )
        )

        return { pluginModules, pluginRegexs }
    }


    #getModuleCredentials( { id, requestedCredentials } ) {
        const { moduleCredentials } = this.#state
        const availableKeys = Object.keys( moduleCredentials )

        let status = false
        let messages = []
        const credentials = requestedCredentials
            .reduce( ( acc, { key }, index ) => {
                if( key === 'processCwd' ) {
                    acc[ key ] = process.cwd()
                } else if( key === 'nodeModulePath' ) {
                    const __filename = fileURLToPath( import.meta.url )
                    const root = path.resolve( __filename, '../../../' )
                    acc[ key ] = `${root}/node_modules`
                } else if( availableKeys.includes( key ) ) {
                    if( !Object.hasOwn( moduleCredentials, key ) ) {
                        status = false
                        messages.push( `${id}: Requested credential ${key} is not available.` )
                    }
                    acc[ key ] = moduleCredentials[ key ]
                    status = true
                } else {
                    status = false
                    messages.push( `${id}: Requested credential ${key} is not available.` )
                }

                return acc
            }, {} )
        
        return { status, messages, credentials }
    }
}


export { CustomModules }