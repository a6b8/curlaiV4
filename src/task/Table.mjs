import fs from 'fs'
import { EventEmitter } from 'events'

import { Generator } from './Generator.mjs'
import { modifyPath } from '../helpers/utils.mjs'


const Table = class extends EventEmitter {
    #config
    #state
    #provider


    constructor( { table, provider, credentials, validCategories } ) {
        super()
        this.#config = { table }

        this.#state = { 
            provider, 
            ...credentials, 
            validCategories 
        }
    }


    async init() {
        const { provider } = this.#state
        this.#provider = await this.#setProvider( { provider } )
        return true
    }

    
    async getTableRows() {
        const funcName = 'getTableRow'
        this.emit( 'print', funcName, 0, {} )

        let status = false
        let messages = []
        let tableRows = []
        let offsetId = 0

        const { provider } = this.#state
        const { columns } = this.#config['table']
        let { tableUrl } = this.#config['table']['providers'][ provider ]

        switch( provider ) {
            case 'spreadsheet':
                const { spreadsheetId, range } = this.#state
                const { messages: m, table } = await this
                    .#getGoogleData( { spreadsheetId, range } )
                tableRows.push( ...table )
                messages.push( ...m )
                offsetId = parseInt( 
                    range
                        .split( '!' )[ 1 ]
                        .split( ':')[ 0 ]
                        .match( /\d+/ )
                )
                tableUrl = tableUrl
                    .replace( '{{SPREADSHEET_ID}}', spreadsheetId )
                break
            default:
                messages.push( `Provider ${provider} is not supported` )
        }
        status = messages.length === 0
        if( !status ) { 
            this.emit( 'print', funcName, 1, { messages } )
            return { status, messages, tableRows }
        }

        const modifiedTable = tableRows
            .map( ( rawRow, index ) => {
                const { rowTableArray } = Generator
                    .convertTableRowToFixedLength( { rawRow, columns } ) 
                const id = index + offsetId
                const { modifiedRowValues } = Generator
                    .modifyTableRowValues( { rowTableArray, columns, id } )
                return modifiedRowValues
            } )
        this.emit( 'print', funcName, 2, { tableUrl } )

        return { status, messages, 'tableRows': modifiedTable }
    }


    sortTableByValidAndInvalidCategories( { tableRows } ) {
        const { validCategories } = this.#state
        const { columns } = this.#config['table']

        const { validTableRows, invalidTableRows } = tableRows
            .reduce( ( acc, rowTableArray, index ) => {
                const { rowTableObject } = Generator
                    .convertTableRowFromArrayToObject( { rowTableArray, columns } )
                const { category } = rowTableObject

                if( validCategories.includes( category ) ) {
                    acc['validTableRows'].push( rowTableArray )
                } else {
                    acc['invalidTableRows'].push( rowTableArray )
                }

                return acc
            }, { 'validTableRows': [], 'invalidTableRows': [] } )

        if( invalidTableRows.length !== 0 ) {
            const { printableInvalids } = this
                .#getPrintableInvalids( { invalidTableRows } )
            this.emit( 'print', 'invalidCategories', 1, { printableInvalids } )
        }

        return { validTableRows, invalidTableRows }
    }


    #getPrintableInvalids( { invalidTableRows } ) {
        if( invalidTableRows.length === 0 ) {
            return false
        }

        const { columns } = this.#config['table']
        const printableInvalids = invalidTableRows
            .map( ( rowTableArray ) => {
                const { rowTableObject }= Generator
                    .convertTableRowFromArrayToObject( { rowTableArray, columns } )
                const { id: rId, category, name: userChannelName, url } = rowTableObject
                const result = { rId, category, userChannelName, url }

                return result
            } )

        return { printableInvalids }
    }


    async #setProvider( { provider } ) {
        switch( provider ) {
            case 'spreadsheet':
                const { scopes } = this.#config['table']['providers'][ provider ]
                const { spreadsheetKeyfile } = this.#state

                const { google } = await import( 'googleapis' )
                const modifiedPath = modifyPath( { 'path': spreadsheetKeyfile } )

                const content = fs.readFileSync( modifiedPath, 'utf-8' )
                const credentials = JSON.parse( content )
                const auth = new google.auth.GoogleAuth( { credentials, scopes } )
                const sheets = google.sheets( { 'version': 'v4', auth } )
                return sheets
            default:
                console.log( 'Table provider not supported.' )
                return false
        }
    } 


    async #getGoogleData( { spreadsheetId, range } ) {
        let status = true
        let messages = []
        let table = null

        try {
            const response = await this.#provider.spreadsheets.values
                .get( { spreadsheetId, range } )
            const { values } = response['data']
            table = values
        } catch( e ) {
            status = false
            messages.push( `Error reading sheet: ${e}` )
        }

        return { status, messages, table }
    }




/*
    #convertRawDataToObjects( { fixedTableLength, offsetSpreadsheetId } ) {
        const offsetSpreadsheetId = parseInt( 
            range
            .split( '!' )[ 1 ]
            .split( ':')[ 0 ]
            .match( /\d+/ )
        )

        const fixedTableLength = values
            .map( ( row, spreadsheetId ) => {
                const placeholderRow = new Array( columns.length )
                    .fill( undefined )
                    .map( ( value, rindex ) => {
                        if( rindex === 0 ) {
                            return spreadsheetId + offsetSpreadsheetId
                        } else {
                            return columns[ rindex ][ 2 ]
                        }
                    } )

                const r = row
                    .reduce( ( acc, value, rindex, arr ) => {
                        acc[ rindex + 1 ] = value
                        return acc
                    }, placeholderRow )

                return r
            } )
        return true
    }
*/

/*
    #checkCategories( { table } ) {
        const { columns } = this.#config['table']
        const { validCategories } = this.#state

        const categoryIndex = columns
            .findIndex( ( column ) => column[ 0 ] === 'CATEGORY' )

        const { valid, invalid } = table
            .reduce( ( acc, row, i ) => {
                const categoryName = row[ categoryIndex ].toLowerCase()
                if( validCategories.includes( categoryName ) ) {
                    acc['valid'].push( row )
                } else {
                    const { id: rId, category, name: userChannelName, url } = arrayRowToObject( { row, columns } )
                    acc['invalid'].push( { rId, category, userChannelName, url } )
                }

                return acc
            }, { 'valid': [], 'invalid': [] } )

        return { valid, invalid }
    }
*/




    #healthCheck() {
        return true
    }
}


export { Table }