import { create } from 'xmlbuilder2'
import { DateTime } from 'luxon'


const Generator = class {
    #config


    constructor( { feed } ) {
        this.#config = { feed }

        return true
    }

/*
    static generateCategoryFeeds( { itemsByCategory, feedTypes } ) {
        const feedContents = Object
            .entries( itemsByCategory )
            .map( ( [ category, items ] ) => {
                const { feedContent } = Generator.generateFeed( { 
                    title: category, items 
                } )
                const keyName = `${category}.xml`
                return { feedContent, keyName }
            } )
        
        return { categoryFeeds }
    }
*/

    static convertTableRowToFixedLength( { rawRow, columns } ) {
        const placeholderRow = new Array( columns.length )
            .fill( undefined )
            .map( ( _, rindex ) => columns[ rindex ][ 2 ] )

        const rowTableArray = rawRow
            .reduce( ( acc, value, rindex, arr ) => {
                acc[ rindex + 1 ] = value
                return acc
            }, placeholderRow )

        return { rowTableArray }
    }


    static modifyTableRowValues( { rowTableArray, columns, id } ) {
        const { rowTableObject } = Generator
            .convertTableRowFromArrayToObject( { rowTableArray, columns } )

        rowTableObject['id'] = id
        rowTableObject['category'] = rowTableObject['category']
            .toLowerCase()

        const { rowTableArray: rTA } = Generator
            .convertTableRowFromObjectToArray( { rowTableObject, columns } )

        return { 'modifiedRowValues': rTA }
    }


    static convertTableRowFromArrayToObject( { rowTableArray, columns } ) {
        const rowTableObject = rowTableArray
            .reduce( ( acc, row, i ) => {
                const [ key,, ] = columns[ i ]
                acc[ key ] = row

                return acc
            }, {} )

        return { rowTableObject }
    }


    static convertTableRowFromObjectToArray( { rowTableObject, columns } ) {
        const rowTableArray = columns
            .reduce( ( acc, [ key,, ] ) => {
                acc.push( rowTableObject[ key ] )

                return acc
            }, [] )

        return { rowTableArray }

    }


/*
    static getTableValueFromItemArrayByKey( { itemArray, itemKey, itemStruct } ) {
        const index = itemStruct
            .findIndex( ( k ) => k === itemKey )
        const value = itemArray[ index ]

        return value
    }
*/

/*
    static setTableValueFromItemArrayByKey( { itemArray, itemKey, itemStruct, value } ) {
        const index = itemStruct
            .findIndex( ( k ) => k === itemKey )
        itemArray[ index ] = value

        return { itemArray }
    }
*/

/*
    static arrayRowToObject( { row, columns } ) {
        const object = row
            .reduce( ( acc, row, i ) => {
                const key = columns[ i ][ 0 ].toLowerCase()
                acc[ key ] = row
    
                return acc
            }, {} )
    
        return object
    }
*/


    static convertFeedItemFromObjectToArray( { itemObject, itemStruct } ) {
        const itemArray = itemStruct
            .reduce( ( acc, key ) => {
                if( Object.hasOwn( itemObject, key ) ) {
                    acc.push( itemObject[ key ] )
                } else {
                    acc.push( undefined )
                }
                return acc
            }, [] )

        return { itemArray }
    }


    static convertFeedItemFromArrayToObject( { itemArray, itemStruct } ) {
        const itemObject = itemStruct
            .reduce( ( acc, key, index ) => {
                acc[ key ] = itemArray[ index ]
                return acc
            }, {} )

        return { itemObject }
    }


    generateCategoryFeed( { category, itemArrays } ) {
        const { itemStruct } = this.#config['feed']
        const itemObjects = itemArrays
            .map( itemArray => {
                const { itemObject } = Generator.convertFeedItemFromArrayToObject( { 
                    itemArray, 
                    itemStruct 
                } )
                return itemObject
            } )
            .sort( ( a, b ) => b['unixTimestamp'] - a['unixTimestamp'] )
        const { feedContent } = this.#generateRssFeed( { itemObjects, category } )

        return { feedContent }
    }


    generateOpmlFeed( { selectionCategory, name } ) {
        const { version, encoding, prettyPrint, type } = this
            .#config['feed']['properties']['opml']

        const opml = 
            create( { version, encoding } )
            .ele( 'opml', { version } )
            .ele( 'head' )
                .ele( 'title' ).txt( name ).up()
            .up()
            .ele('body')

        selectionCategory
            .forEach( ( a ) => {
                const { url: xmlUrl, title } = a
                opml.ele('outline', { title, type, xmlUrl }).up()
            } )

        opml
            .up()
            .up()
            // .up()
        const opmlContent = opml.end( { prettyPrint } )

        return { opmlContent }
    }


    #generateRssFeed( { itemObjects, category } ) {
        const { version, encoding, xmlns, xmlns_dc, xml_lang, rel, timeRegion, prettyPrint } = this
            .#config['feed']['properties']['category']

        const currentTime = DateTime.now()
            .setZone( timeRegion )
            .toISO()
            .replace( '.000', '' )

        const xml = 
            create( { version, encoding } )
            .ele( 'feed', { xmlns, 'xmlns:dc': xmlns_dc, 'xml:lang': xml_lang } )
                .ele( 'author' )
                    .ele( 'name' ).txt( '' ).up()
                .up()
                .ele( 'id' ).txt( '' ).up()
                .ele( 'title' ).txt( category ).up()
                .ele( 'updated' ).txt( currentTime ).up()
                .ele( 'dc:date' ).txt( currentTime ).up()

        itemObjects
            .forEach( ( itemObject, i ) => {
                const { url: href, headline, unixTimestamp } = itemObject
                const date = DateTime
                    .fromSeconds( unixTimestamp )
                    .setZone( timeRegion )
                    .toISO()
                    .replace( '.000', '' )

                xml
                    .ele( 'entry' )
                        .ele( 'id' ).txt( href ).up()
                        .ele( 'link', { rel, href }).up()
                        .ele( 'title' ).txt( headline ).up()
                        .ele( 'updated' ).txt( date ).up()
                        .ele( 'dc:date' ).txt( date ).up()
                    .up()
            } )
        xml.up()
        const feedContent = xml.end( { prettyPrint } )

        return { feedContent }
    }

}


export { Generator }