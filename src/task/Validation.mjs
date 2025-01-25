import { envToObject } from './../helpers/utils.mjs'
import { config } from './../data/config.mjs'


const Validation = class {
    constructor() {

    }


    static moduleFolderPath( { envContent, moduleFolderPath } ) {
        let status = false
        const messages = []

        if( typeof moduleFolderPath !== 'string' ) {
            messages.push( 'Module folder path is not a string' )
        }

        if( messages.length !== 0 ) {
            return { status, messages }
        }

        const { envModuleFolderKey } = config['merger']['envModuleFolderKey']
        const selection = [ [ 'moduleFolderPath', envModuleFolderKey ] ]
        const result = envToObject( { envContent, selection } )
        status = messages.length === 0

        return { status, messages, result }
    }


    static tableCredentials( { envContent, provider } ) {
        let status = false
        const messages = []
        let result = {}

        if( typeof envContent !== 'string' ) {
            messages.push( 'Environment content is not a string' )
        }

        if( typeof provider !== 'string' ) {
            messages.push( 'Data source is not a string' )
        }

        if( !Object.keys( config['table']['providers'] ).includes( provider ) ) {
            messages.push( `Data source ${provider} is not supported` )
        }

        if( messages.length !== 0 ) {
            return { status, messages, result }
        }

        const selection = Object
            .entries( config['table']['providers'][ provider ]['credentials'] )
            .map( ( [ key, values ] ) => {
                const { name } = values
                const selection = [ name, key ]
                return selection
            } )

        result = envToObject( { envContent, selection } )
        Object
            .entries( result )
            .forEach( ( [ key, value ] ) => {
                if( value === undefined ) {
                    const [ , envVarName ] = selection.find( ( [ name, k ] ) => name === key )
                    messages.push( `Variable ${envVarName} is required` )
                }
            } )

        status = messages.length === 0

        return { status, messages, result }
    }


    static storageCredentials( { envContent, provider } ) {
        let status = false
        const messages = []
        let result = {}

        if( typeof envContent !== 'string' ) {
            messages.push( 'Environment content is not a string' )
        }

        if( typeof provider !== 'string' ) {
            messages.push( 'Data source is not a string' )
        }

        if( !Object.keys( config['storage']['providers'] ).includes( provider ) ) {
            messages.push( `Data source ${provider} is not supported` )
        }

        if( messages.length !== 0 ) {
            return { status, messages, result }
        }

        const selection = Object
            .entries( config['storage']['providers'][ provider ]['credentials'] )
            .map( ( [ key, values ] ) => {
                const { name } = values
                const selection = [ name, key ]
                return selection
            } )

        result = envToObject( { envContent, selection } )
        Object
            .entries( result )
            .forEach( ( [ key, value ] ) => {
                if( value === undefined ) {
                    const [ , envVarName ] = selection
                        .find( ( [ name, ] ) => name === key )
                    messages.push( `Variable ${envVarName} is required` )
                }
            } )
        status = messages.length === 0

        return { status, messages, result }
    }


    check() {
        return true
    }
}


export { Validation }

