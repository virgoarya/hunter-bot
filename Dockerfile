# Use the official Node.js image.
FROM node:20

# Set the working directory.
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory.
COPY package*.json ./

# Install the application's dependencies.
RUN npm install

# Copy the rest of the application's code.
COPY . .

# Command to run the application.
CMD ["npm", "start"]
