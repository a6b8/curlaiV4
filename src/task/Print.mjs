import { DynamicAsciiTable } from 'dynamic-ascii-table'


const Print = class {
    #config
    #state
    #dt


    constructor( { print } ) {
        this.#config = { print } 
        this.#state = {}
        this.#dt = new DynamicAsciiTable()
        const { merger } = this.#config['print']['tables']
        this.#dt.init( merger )
    }


    static createEventStruct( data, status ) {
        const stack = new Error().stack
        const stackLines = stack.split( "\n" )
        const callerLine = stackLines[ 2 ]
        const match = callerLine.match( /at\s(.*?)\s/ )
        if( !match ) { 
            console.log( 'CreateEmitDataStruct: unknown caller' )
            return false
        }
        const func = match[ 1 ]
            .split( '.' )[ 1 ]
        const result = { status, func, data }

        return result
    }
 

    updateState( { extensionId, type, value } ) {
        if( !this.#state[ extensionId ] ) {
            const { emojis } = this.#config['print']
            this.#state[ extensionId ] = {
                'success': 0,
                'errors': 0,
                'unused': 0
            }

            const rowIndex = Object.keys( this.#state ).length - 1
            const a = [ 
                [ 'extension', extensionId       ], 
                [ 'status',    emojis['running'] ],
                [ 'success',   0                 ], 
                [ 'errors',    0                 ], 
                [ 'unused',    0                 ] 
            ]
                .forEach( ( a ) => {
                    const [ columnName, value ] = a
                    this.#dt.setValue( { rowIndex, columnName, value } )
                    return true
                } )
        }

        if( type === 'status' ) {
            const { emojis } = this.#config['print']
            const str = emojis[ value ]
            const rowIndex = Object
                .keys( this.#state )
                .findIndex( a => a === extensionId )
            this.#dt.setValue( { rowIndex, 'columnName': type, 'value': str } )
            return true
        }

        if( value !== undefined ) {
           this.#state[ extensionId ][ type ] = value
        } else {
            this.#state[ extensionId ][ type ]++
        }

        const rowIndex = Object
            .keys( this.#state )
            .findIndex( a => a === extensionId )
        const _value = this.#state[ extensionId ][ type ]
        this.#dt.setValue( { rowIndex, 'columnName': type, 'value': _value } )

        return true
    }


    print() {
        this.#dt.print()
        return true
    }
}


export { Print }