import os from 'os'


function envToObject( { envContent, selection } ) {
/*
    const selection = [
        [ 'privateKey', 'SOLANA_PRIVATE_KEY'     ],
        [ 'publicKey',  'SOLANA_PUBLIC_KEY'      ],
        [ 'apiKey',     'SOLANA_TRACKER_API_KEY' ],
        [ 'nodeUrl',    'SOLANA_MAINNET_HTTPS'   ]
    ]
*/

    const found = envContent
        .split( "\n" )
        .map( line => line.split( '=' ) )
        .reduce( ( acc, [ k, v ], i ) => {
            const find = selection.find( ( [ key, value ] ) => value === k )
            if( find ) { acc[ find[ 0 ] ] = v }
            return acc
        }, {} )

    const result = selection
        .reduce( ( acc, [ name, key ], index ) => {
            if( Object.hasOwn( acc, name ) ) { return acc }
            acc[ name ] = undefined

            return acc
        }, found )

    return result
}


function formatDateWithOffset( date ) {
    const pad = ( num ) => String( num ).padStart( 2, '0' )

    const year = date.getFullYear()
    const month = pad( date.getMonth() + 1 )
    const day = pad( date.getDate() )
    const hours = pad( date.getHours() )
    const minutes = pad( date.getMinutes() )
    const seconds = pad( date.getSeconds() )

    const offsetMinutes = date.getTimezoneOffset()
    const offsetHours = Math.abs(Math.floor( offsetMinutes / 60 ) )
    const offsetRemainingMinutes = Math.abs( offsetMinutes % 60 )
    const offsetSign = offsetMinutes <= 0 ? '+' : '-'

    const offset = `${offsetSign}${pad( offsetHours )}:${pad( offsetRemainingMinutes )}`

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offset}`
}


function prettyPrintRow( { first, second, paddingFirst=20 } ) {
    if( first.length > paddingFirst - 3 ) {
        first = first.slice( 0, paddingFirst - 3 ) + '...'
    }
    const padding = ' '.repeat( paddingFirst - first.length )
    return `${first}${padding}${second}`
}


function modifyPath( { path } ) {
    const homeDir = os.homedir()
    if( path.startsWith( '~' ) ) {
        return path.replace( '~', homeDir )
    } {
        return path
    }
}


export { 
    envToObject, 
    formatDateWithOffset,
    prettyPrintRow,
    modifyPath
}