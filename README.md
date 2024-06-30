

TODO:

- Update to ES6 imports?

----------------------

# SETTINGS

1. Update the APP_URL to your own domain

----------------------

# ENVIRONMENT VARIABLES

### JWT & SESSION secret

1. Generate your JWT and Session Secret keys by running this line in the terminal:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'));"
```

2. Add your keys to the .env file in the root folder


### PRODUCTION

1. Set PRODUCTION=false or PRODUCTION=true in the .env file

----------------------

# DATABASES

## Configure Sequelize

1. Update config/config.json to set up database configurations for different environments.

## Create the database for the first time

1. Uncomment the "RESET DATABASE" section in models.js and run the server once to create the database for the first time. 
2. Be sure to comment out the "RESET DATABASE" section after the database has been created.

## Migrate the database

1. Run the following command to migrate the database:
```
npx sequelize db:migrate
```

----------------------

# ERROR MONITORING (optional)

- Setup something like Airbrake to get alerts.



# TEMPLATING

We use Nunjucks for templating. To learn more about Nunjucks, visit the official documentation:
https://mozilla.github.io/nunjucks/