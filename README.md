**In Development**

# Curlai Version 4
Curlai provides the ability to aggregate information from various resources, such as RSS feeds, into categories. Through an extension module, the CLI can be seamlessly extended to merge restricted data (with authentication) or free `.rss` and `.atom` feeds. The result can then be accessed via an RSS reader with WebView functionality.

## Features
Data can be read from:
- Google Spreadsheet  

Public data can be stored in:
- AWS S3  

## Quickstart

A `.env` file with at least the following credentials must be present. To ensure proper detection, it is recommended to use the `~` syntax.

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

YOUTUBE_OAUTH_CLIENT_ID=
YOUTUBE_OAUTH_CLIENT_KEY=
YOUTUBE_OAUTH_KEY_FILE=
```

To execute, run the following:

```bash
npm link
curlai
```

## Table of Contents
- [Curlai Version 4](#curlai-version-4)
  - [Features](#features)
  - [Quickstart](#quickstart)
  - [Table of Contents](#table-of-contents)
  - [Functions](#functions)
  - [Extension](#extension)
  - [License](#license)

## Functions
The following functions are available in the CLI:

**generate_feeds**  
Downloads RSS feeds, modifies individual items, and categorizes them based on the configured categories.

**create_opmls**  
Generates an `.opml` file for each main category, simplifying the process of loading individual feeds into an RSS reader.

Example of the required `opml.mjs`:

```mjs
const opmlCategories = {
    'Evening': [
        { 'name': 'experimental', 'ai': false },
        { 'name': 'art', 'ai': false },
        { 'name': 'development', 'ai': false },
        { 'name': 'programming', 'ai': false },
        { 'name': 'hype technologies', 'ai': false },
        { 'name': 'lifestyle', 'ai': false },
        { 'name': 'music', 'ai': false },
        { 'name': 'philosophy', 'ai': false },
        { 'name': 'politics', 'ai': false }
    ],
    'Morning': [
        { 'name': 'talks tech', 'ai': false },
        { 'name': 'research', 'ai': false },
        { 'name': 'sport', 'ai': false },
        { 'name': 'talks business', 'ai': false },
        { 'name': 'universe', 'ai': false },
        { 'name': 'rap', 'ai': false },
        { 'name': 'other', 'ai': false }
    ]
}

export { opmlCategories }
```

**find_new_youtube_channels**  
This function is helpful for adding new YouTube channels. For proper implementation, the `channelId` is required, which is not readily available. Therefore, the function performs the following:
- Conducts OAuth authentication.
- Downloads up to the last 1,000 liked videos.
- Calculates the intersection of previously subscribed and liked channels.
- Saves this intersection as a `.tsv` file for further use.

The file is now ready to be imported via the **import** function, for example, into Google Spreadsheet.

## Extension

An extension must be placed in the `customFolder` directory within the `extensions` folder. During initialization, the extension is automatically detected. The extension can also request variables, which must be defined under `requestedCredentials` in the config (`cfg`) object. Since the custom folder may be located in a different directory, the `nodeModulePath` can be used to query the module folder path, enabling module imports.

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