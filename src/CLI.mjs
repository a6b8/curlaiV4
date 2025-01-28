import inquirer from 'inquirer'
import figlet from 'figlet'
import chalk from 'chalk'

import fs from 'fs'

import { RssMerger } from './index.mjs'
import { config } from './data/config.mjs'
import { Validation } from './task/Validation.mjs'
import { 
    envToObject, 
    modifyPath
} from './../src/helpers/utils.mjs'


const CLI = class {
    #state
    #config
    #rss


    constructor() {
        this.#config = config
        this.#state = {}

        return true
    }


    async start() {
        this.#rss = new RssMerger( { config } )
        this.#addHeadline()

        this.#state['envPath'] = await this.#setEnvPath()
        const envContent = fs.readFileSync( this.#state['envPath'], 'utf8' )
        this.#state['command'] = await this.#setCommand()

        const { root } = config['custom']['folder']
        const { command } = this.#state
        if( command === 'create_opmls' ) {
            this.#state['storageProvider'] = await this.#setStorageProvider()
            this.#state['storageCredentials'] = this.#setStorageCredentials( { envContent } )
            this.#state['opmlOutputFolder'] = await this.#setOpmlOutputFolder()
            await this.#routeCreateOpmls( { root, envContent } )
        } else if( command === 'generate_feeds' ) {
            this.#state['storageProvider'] = await this.#setStorageProvider()
            this.#state['storageCredentials'] = this.#setStorageCredentials( { envContent } )
            this.#state['tableProvider'] = await this.#setTableProvider()
            this.#state['tableCredentials']= this.#setTableCredentials( { envContent } )
            await this.#routeGenerateFeeds( { root, envContent } )
        } else if( command === 'find_new_youtube_channels' ) {
            this.#state['tableProvider'] = await this.#setTableProvider()
            this.#state['tableCredentials']= this.#setTableCredentials( { envContent } )
            this.#state['newChannelsFolder'] = await this.#setNewChannelsFolder()
            await this.#routeFindNewYoutubeChannels( { root, envContent } )

            // const { result } = this.#rss.getNewYoutubeChannels()
            // console.log( '>>>', result )
        } else {
            console.log( chalk.red(
                `Command ${command} is not recognized` 
            ) )
        }

        return true
    }


    async #routeFindNewYoutubeChannels( { root, envContent } ) {
        const { moduleFolderPath } = envToObject( { 
            envContent, 
            'selection': [ [ 'moduleFolderPath', root ] ]
        } )

        const moduleCredentials = envToObject( { 
            envContent, 
            'selection': [ 
                [ 'youtubeTemplateUrl', 'YOUTUBE_TEMPLATE_URL' ],
                [ 'htTemplateUrl', 'HT_TEMPLATE_URL' ]
            ]
        } )

        const tableCredentials = {
            'provider': this.#state['tableProvider'],
            'credentials': this.#state['tableCredentials']
        }

        const youtubeCredentials = envToObject( { 
            envContent, 
            'selection': [ 
                [ 'clientId',     'YOUTUBE_OAUTH_CLIENT_ID'  ],
                [ 'clientSecret', 'YOUTUBE_OAUTH_CLIENT_KEY' ],
                [ 'tokenPath',    'YOUTUBE_OAUTH_KEY_FILE'   ]
            ]
        } )

        youtubeCredentials['tokenPath'] = modifyPath( { 'path': youtubeCredentials['tokenPath'] } )
        const { tsv, data } = await this.#rss.getNewYoutubeChannels( { 
            tableCredentials, 
            youtubeCredentials,
            moduleFolderPath,
            moduleCredentials
        } ) 

        const { newChannelsFolder } = this.#state
        const path= `${newChannelsFolder}/new_channels.tsv`
        const filePath = modifyPath( { path } )
        fs.writeFileSync( filePath, tsv, 'utf-8' )

        return true
    }


    async #routeCreateOpmls( { root, envContent } ) {
        const selection = [ [ 'moduleFolderPath', root ] ]
        const { moduleFolderPath } = envToObject( { envContent, selection } )

        const { storageProvider: provider, storageCredentials: credentials } = this.#state
        const { opmlContents } = await this.#rss.createOpmls( { 
            provider, credentials, moduleFolderPath, outputPath: './' 
        } )

        const { opmlOutputFolder } = this.#state
        opmlContents
            .forEach( ( { name, opmlContent } ) => {
                const filePath = `${opmlOutputFolder}/${name}.xml`
                fs.writeFileSync( filePath, opmlContent, 'utf-8' )
                console.log( chalk.green( `${filePath} written successfully` ) )
                return true
            } )
    }


    async #routeGenerateFeeds( { root, envContent } ) {
        const { moduleFolderPath } = envToObject( { 
            envContent, 
            'selection': [ [ 'moduleFolderPath', root ] ]
        } )

        const moduleCredentials = envToObject( { 
            envContent, 
            'selection': [ 
                [ 'youtubeTemplateUrl', 'YOUTUBE_TEMPLATE_URL' ],
                [ 'htTemplateUrl', 'HT_TEMPLATE_URL' ]
            ]
        } )

        await this.#rss.init( { 
            'tableCredentials': {
                'provider': this.#state['tableProvider'],
                'credentials': this.#state['tableCredentials']
            },
            'storageCredentials': {
                'provider': this.#state['storageProvider'],
                'credentials': this.#state['storageCredentials']
            },
            moduleFolderPath,
            moduleCredentials
        } )

        await this.#rss.start()

        return true
    }


    #addHeadline() {
        const { text, params } = this.#config['cli']['headline']
        console.log( chalk.green( 
            figlet.textSync( text, params ) 
        ) )
        return true
    }


    async #setCommand() {
        const { command } = await inquirer.prompt( [
            {
                'type': 'list',
                'name': 'command',
                'message': 'Select command:',
                'choices': [ 'generate_feeds', 'create_opmls', 'find_new_youtube_channels' ],
            }
        ] )

        return command
    }


    async #setEnvPath() { 
        const { defaultEnv } = this.#config['cli']
        let { envPath } = await inquirer.prompt( [
            {
                'type': 'input',
                'name': 'envPath',
                'message': `Default environment file:`,
                'default': defaultEnv,
            }
        ] )
        envPath = modifyPath( { 'path': envPath } )

        if( fs.accessSync( envPath, fs.constants.R_OK ) ) {
            console.log( 
                chalk.red( 
                    `File ${envPath} does not exist or is not readable` 
                ) 
            )
            process.exit( 1 )
        }

        return envPath
    }


    async #setNewChannelsFolder() {
        const { defaultNewChannelsFolder } = this.#config['cli']
        let { newChannelsFolder } = await inquirer.prompt( [
            {
                'type': 'input',
                'name': 'newChannelsFolder',
                'message': `Folder for new channels:`,
                'default': defaultNewChannelsFolder,
            }
        ] )
        newChannelsFolder = modifyPath( { 'path': newChannelsFolder } )

        return newChannelsFolder

    }


    async #setOpmlOutputFolder() {
        const { defaultOpmlFolder } = this.#config['cli']
        let { opmlOutputFolder } = await inquirer.prompt( [
            {
                'type': 'input',
                'name': 'opmlOutputFolder',
                'message': `Output folder for OPML files:`,
                'default': defaultOpmlFolder,
            }
        ] )
        opmlOutputFolder = modifyPath( { 'path': opmlOutputFolder } )

        return opmlOutputFolder
    }


    async #setTableProvider() {
        const choices = Object.keys( this.#config['table']['providers'] )
        const defaultProvider = this.#config['table']['default']

        const { provider } = await inquirer.prompt( [
            {
                'type': 'list',
                'name': 'provider',
                'message': 'Select Table Provider:',
                'default': defaultProvider,
                choices,
            }
        ] )

        return provider
    }


    #setTableCredentials( { envContent } ) {
        const { tableProvider } = this.#state
        const { status, messages, result } = Validation
            .tableCredentials( { envContent, 'provider': tableProvider } )

        if( !status ) {
            console.log( chalk.red( messages.join( '\n' ) ) )
            process.exit( 1 )
        }

        return result
    }


    async #setStorageProvider() {
        const choices = Object.keys( this.#config['storage']['providers'] )
        const { provider } = await inquirer.prompt( [
            {
                'type': 'list',
                'name': 'provider',
                'message': 'Select Storage Provider:',
                choices,
            }
        ] )

        return provider
    }


    #setStorageCredentials( { envContent } ) {
        const { storageProvider } = this.#state
        const { status, messages, result } = Validation
            .storageCredentials( { envContent, 'provider': storageProvider } )

        if( !status ) {
            console.log( chalk.red( messages.join( '\n' ) ) )
            process.exit( 1 )
        }

        return result
    }
}


export { CLI }
