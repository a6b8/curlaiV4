# Curlai Version 4

**In Development**

Curlai offers the capability to aggregate information from various resources, such as RSS feeds, into categories. Through an extension module, the CLI can be seamlessly extended and can merge both restricted data (with authentication) and open data like `.rss` and `.atom` feeds. The result can then be accessed using an RSS reader with a webview function.

## Features
Data can be read from:
- Google Spreadsheet

Public data can be saved to:
- AWS S3

## Quickstart

A `.env` file with at least the following credentials is required. To ensure proper detection, it is best to use the `~` syntax.

```bash
SPREADSHEET_KEYFILE=
SPREADSHEET_EMAIL=
SPREADSHEET_ID=
SPREADSHEET_RANGE=

AWS_S3_ACCESS_KEY_ID=
AWS_S3_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=
AWS_S3_REGION=
AWS_S3_FOLDER_PATH=

CUSTOM_FOLDER=
```

To execute, use:

```bash
npm link
curlai
```

### Code

This example shows how to query public nodes with Node.js.

## Table of Contents
- [Curlai Version 4](#curlai-version-4)
  - [Features](#features)
  - [Quickstart](#quickstart)
    - [Code](#code)
  - [Table of Contents](#table-of-contents)
  - [Extension](#extension)
  - [License](#license)

## Extension

An extension must be placed in the `customFolder` directory under the `extensions` folder. During initialization, the extension will be automatically detected. The extension can also request variables, which must be defined under `requestedCredentials` in the configuration (`cfg`) object. Since the `customFolder` might be located in a different place than the extensions, the module folder path can also be queried via `nodeModulePath`. This enables importing modules.

```mjs
const Extension = class {
    #parser
    #state


    static cfg = {
        'id': 'myExtension',
        'regexs': [ /^https?:\/\/(www\.)?example\.com\/feeds\// ],
        'mediaType': 'video',
        'maxSameRequests': 10,
        'defaultDelay': 200,
        'penalties': [
            { 'range': [ 2, 5 ],  'delay': 500, 'cancel': false },
            { 'range': [ 6, 10 ], 'delay': 1000, 'cancel': false },
            { 'range': [ 11 ],    'delay': null, 'cancel': true  },
        ],
        'requestedCredentials': [
            {
                'key': 'nodeModulePath',
                'description': 'Current working directory'
            },
            {
                'key': 'exampleTemplateUrl',
                'description': 'Example'
            }
        ],
        'struct': [ 'url', 'userChannelName' ]
    }


    constructor() {
        this.#parser = null
    }


    static getConfig() {
        return this.cfg
    }


    async init( { credentials } ) {
        const { nodeModulePath, exampleTemplateUrl } = credentials
        this.#parser = await this.#addRssParser( { nodeModulePath } )
        this.#state = { nodeModulePath, exampleTemplateUrl }

        return true
    }


    async getFeed( { url, userChannelName, feedCategory } ) {
        const { status, messages, feed } = await this.#parseFeed( { url } )
        if( !status ) { return { status, messages, 'results': null } }
        const results = feed['items']
            .map( ( item ) => {
                ...
                const unixTimestamp = Math.floor( new Date( isoDate ).getTime() / 1000 )
                const result = { url, title, mediaType, customChannelName, feedCategory, unixTimestamp }

                return result
            } )

        return { status, messages, results }
    }


    async #addRssParser( { nodeModulePath } ) {
        const { default: Parser } = await import( `${nodeModulePath}/rss-parser/index.js` )
        const parser = new Parser()
        return parser
    }


    async #parseFeed( { url } ) {
        let status = true
        let messages = []
        let feed = null

        try {
            feed = await this.#parser.parseURL( url )
        } catch( e ) {
            status = false
            messages.push( 'Error reading feed' )
        }

        return { status, messages, feed }
    }
}


export { Extension }
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.