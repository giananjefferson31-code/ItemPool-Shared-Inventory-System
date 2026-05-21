# How to Run ITEMPOOL

## Prerequisites
Make sure you have the following installed on your machine:
- Node.js
- Expo CLI
- A mobile device with the Expo Go app or an emulator

## Installation

Clone the repository:
git clone https://github.com/giananjefferson31-code/ItemPool-Shared-Inventory-System.git

Navigate to the project folder:
cd ItemPool-Shared-Inventory-System

Install dependencies:
npm install
npm install firebase
npm install react-hook-form

## Firebase Setup

1. Go to console.firebase.google.com
2. Create a project
3. Enable Authentication - Email/Password
4. Enable Firestore Database - start in test mode
5. Go to Project Settings and copy your Firebase config
6. Paste the config values into the firebaseConfig section inside App.js

## Running the App

npx expo start

Then scan the QR code with the Expo Go app on your phone.