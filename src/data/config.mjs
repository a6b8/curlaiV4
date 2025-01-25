const config = {
    'cli': {
        'defaultEnv': '~/.curlaiV4/cred.env',
        'defaultOpmlFolder': '~/Desktop',
        'headline': {
            'text': 'Curlai',
            'params': { 
                'horizontalLayout': 'full',
                'font': 'Slant' 
            }
        }
    },
    'custom': {
        'folder': {
            'root': 'CUSTOM_FOLDER',
            'subfolders': {
                'extension': 'extensions'
            },
            'category': {
                'file': 'opml.mjs',
            }
        }
    },
    'table': {
        'default': 'spreadsheet',
        'providers': {
/*
            'airTable': {
                'AIRTABLE_API_KEY': {
                    'name': 'airTableApiKey',
                    'message': 'AirTable API key is required'
                },
                'AIRTABLE_BASE_ID': {
                    'name': 'airTableBaseId',
                    'message': 'AirTable base ID is required'
                },
                'AIRTABLE_TABLE_NAME': {
                    'name': 'airTableTableName',
                    'message': 'AirTable table name is required'
                },
            },
*/
            'spreadsheet': {
                'tableUrl': 'https://docs.google.com/spreadsheets/d/{{SPREADSHEET_ID}}/',
                'scopes': [ 'https://www.googleapis.com/auth/spreadsheets' ],
                'credentials': {
                    'SPREADSHEET_KEYFILE': {
                        'name': 'spreadsheetKeyfile',
                        'message': 'Spreadsheet keyfile is required'
                    },
                    'SPREADSHEET_ID': {
                        'name': 'spreadsheetId',
                        'message': 'Spreadsheet ID is required'
                    },
                    'SPREADSHEET_RANGE': {
                        'name': 'range',
                        'message': 'Spreadsheet range is required'
                    }
                }
            }
        },
        'columns': [
            [ 'id',       'ID',       undefined ],
            [ 'url',      'URL',      undefined ],
            [ 'name',     'NAME',     undefined ],
            [ 'category', 'CATEGORY', 'default' ],
            [ 'status',   'STATUS',   'n/a'     ],
            [ 'source',   'SOURCE',   'n/a'     ]
        ],
        'statusTypes': {
            'ok': 'ok',
            'rejected': 'rejected',
        }
    },
    'storage': {
        'providers': {
            's3': {
                'ACL': 'public-read',
                'subfolders': {
                    'categories': 'categories',
                    'viewer': 'viewer',
                },
                'credentials': {
                    'AWS_S3_ACCESS_KEY_ID': {
                        'name': 'awsS3AccessKeyId',
                        'message': 'AWS S3 access key is required'
                    },
                    'AWS_S3_SECRET_ACCESS_KEY': {
                        'name': 'awsS3SecretAccessKey',
                        'message': 'AWS S3 secret access key is required'
                    },
                    'AWS_S3_BUCKET_NAME': {
                        'name': 'awsS3BucketName',
                        'message': 'AWS S3 bucket name is required'
                    },
                    'AWS_S3_REGION': {
                        'name': 'awsS3Region',
                        'message': 'AWS S3 region is required'
                    },
                    'AWS_S3_FOLDER_PATH': {
                        'name': 'awsS3FolderPath',
                        'message': 'AWS S3 folder path is required'
                    }
                }

            }
        }
    },
    'merger': {},
    'feed': {
        'headlines': {
            'current': 'default',
            'default': {
                'splitter': ' | ',
                'more': '...',
                'elements': [
                    {
                        'key': 'mediaType',
                        'modifiers': [
                            [ 'mediaType',       {} ]
                        ]
                    },
                    {
                        'key': 'customChannelName',
                        'modifiers': [ 
                            [ 'trim',            {} ], 
                            [ 'uppercase',       {} ],
                            // [ 'onlyUtf8',        {} ],
                            [ 'notLongerThen',   { 'l': 50 } ]
                        ]
                    },
                    {
                        'key': 'title',
                        'modifiers': [ 
                            [ 'trim',             {} ],
                            [ 'titleize',         {} ],
                            // [ 'onlyUtf8',         {} ],
                            [ 'notLongerThen',    { 'l': 100 } ] 
                        ]
                    }
                ]
            }
        },
        'funcs': {
            'mediaType': ( str, {}, { mediaType } ) => {
                const choose = {
                    'video': '■',
                    'website': '▒',
                    'other': 'OTHER'
                }

                return choose[ mediaType ]
            },
            'trim': ( str ) => {
                return str.trim()
            },
            'uppercase': ( str ) => {
                return str.toUpperCase()
            },
            'onlyUtf8': ( str ) => {
                return str.replace( /[^\x00-\x7F]/g, '' )
            },
            'notLongerThen': ( str, { l } ) => {
                return str.length > l ? str.slice( 0, l ) : str
            },
            'titleize': ( str ) => {
                    return str
                        .split( ' ' )
                        .map( word => word.charAt( 0 ).toUpperCase() + word.slice( 1 ).toLowerCase() )
                        .join( ' ' )
                }
        },
        'properties': {
            'category': {
                'ContentType': 'application/xml',
                'version': '1.0',
                'encoding': 'UTF-8',
                'xmlns': 'http://www.w3.org/2005/Atom',
                'xmlns_dc': 'http://purl.org/dc/elements/1.1/',
                'xml_lang': 'en-US',
                'rel': 'alternate',
                'timeRegion': 'Europe/Berlin',
                'prettyPrint': true
            },
            'opml':  {
                'version': '1.0',
                'encoding': 'UTF-8',
                'prettyprint': true,
                'type': 'rss'
            }
        },
        'itemStruct': [ 'url', 'title', 'headline', 'mediaType', 'customChannelName', 'feedCategory', 'unixTimestamp' ],
        'feedTypes': {
            'current': 'atom1',
            'atom1': {
                'modifiers': [
                    [ `&amp;`, `&` ],
                    [ `<link href=`, `<link rel="alternate" href=` ]
                ]
            },
            'rss2': {
                'modifiers': [
                    [ `&amp;`, `&` ],
                    // [ `<link>`, `<link rel="alternate">` ]
                ]
            }
        }
    },
    'print': {
        'tables': {
            'merger': { 
                'columnNames': [ 'nr', 'extension', 'status', 'success', 'errors', 'unused' ], 
                'columnLengths': [ 5, 20, 10, 10, 10, 10 ],
                'columnAlignments': [ 'left', 'left', 'right', 'right', 'right', 'right' ],
                'headerAlignment': 'center' 
            }
        },
        'emojis': {
            'finished': "🎉",  // andere emoji wie '✅' oder '👍' sind auch möglich
            'running': '🔧',
        }
    }
}


export { config }