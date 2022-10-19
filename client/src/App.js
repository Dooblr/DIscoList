// Dependencies
import React, { useEffect, useState, createContext } from 'react'
import {Form, Button, ListGroup, Spinner, Row, Col} from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import axios from 'axios'
import useAsyncEffect from 'use-async-effect'

// Components
import Tracklist from './Tracklist'
import LoadingSpinner from './LoadingSpinner';
import InputForm from './InputForm';

// Theme context for dark mode
export const ThemeContext = createContext(null)

function App() {

  let devState = "dev" // "prod" / "dev"
  let hosturl = ""
  let spotify_redirect_uri = ""

  if (devState === "prod") {
    // Express server address
    hosturl = "http://54.176.233.72:8888"
    spotify_redirect_uri = 'http://54.176.233.72:8888/';
  } else if (devState === "dev") {
    // Express server address 
    hosturl = "http://localhost:5000"
    spotify_redirect_uri = 'http://localhost:3000';
  }

  // State ============================================================ //

  // UI State
  const [labelSearchInput, setLabelSearchInput] = useState('');
  const [queryMax, setQueryMax] = useState(20);
  const [isLoading, setIsLoading] = useState(false);
  const [spotifyIsCreating, setSpotifyIsCreating] = useState(false)
  const [spotifyUsername, setSpotifyUsername] = useState('')
  const [theme, setTheme] = useState("dark");

  // Auth State
  const [spotifyToken, setSpotifyToken] = useState('');

  // Tracklist state
  const [tracklist, setTracklist] = useState(null);

  // Spotify Auth ==================================================== //

  // Get spotify keys from .env
  const spotify_client_id = process.env.REACT_APP_SPOTIFYCLIENTID
  
  // Spotify auth
  const spotify_auth_endpoint = 'https://accounts.spotify.com/authorize';
  const spotify_response_type = 'token';

  // Handlers ====================================================== //

  // Sets input state on every keystroke
  function searchInputHandler(event) {
    setLabelSearchInput(event.target.value);
  };

  function setQueryMaxHandler(event) {
    setQueryMax(event.target.value)
  }

  // Fetches a list of artists and titles and sets tracklist state to the response
  function searchButtonHandler() {
    
    // Clear track list
    setTracklist(null)

    // Set loading status
    setIsLoading(true)

    fetch(hosturl + '/search?search=' + labelSearchInput + "&max=" + queryMax)
      .then(res => res.json())
      .then(data => {
        setTracklist(data)
        setIsLoading(false)
      });
  };

  async function createPlaylistHandler(){
    
    setSpotifyIsCreating(true)

    // Get user ID
    const userID = await getUserID()

    // Create an empty playlist
    const createPlaylistResponse = await axios.post(`https://api.spotify.com/v1/users/${userID}/playlists`,
      {
        "name": `${labelSearchInput}`,
        "description": `Discolist made this playlist based on ${labelSearchInput}`,
        "public": false
      }, 
      {
        headers:{
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Authorization": "Bearer " + spotifyToken
        }
    })
    // // // Get the playlist ID from the response
    const playlistID = createPlaylistResponse.data.id

    // Get a list of spotify URI's from the tracklist state
    const spotifyURIs = await getSpotifyURIs(tracklist)
    
    await addSpotifyTracksToPlaylist(playlistID, spotifyURIs)

    setSpotifyIsCreating(false)
  }

  // takes a Spotify playlist ID and an array of spotify URIs -> adds them to a spotify playlist
  async function addSpotifyTracksToPlaylist(spotifyPlaylistID, spotifyUriArray){
    console.log(spotifyUriArray.toString())
    const addTracksResponse = await axios.post(`https://api.spotify.com/v1/playlists/${spotifyPlaylistID}/tracks?uris=${spotifyUriArray.toString()}`, {},
    {
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": "Bearer " + spotifyToken
      }
    })
    console.log(addTracksResponse)
    setSpotifyUsername(addTracksResponse)
  }

  // [{Artist:"",Track:"",Release:""}] -> [spotifyURI]
  async function getSpotifyURIs(tracklist){

    // Create empty array for spotify uris
    let spotifyURIs = []

    // Run Spotify searches for each item in the track list and add them 
    for (const [index, release] of tracklist.entries()) {
      
      // remove commas from artist name so it does not 
      // let artistNoCommas = release.artist.replaceAll(',', '');

      const spotifyData = await axios(`https://api.spotify.com/v1/search?q=${release.trackTitle}%20${release.artist}&type=track&limit=50`, {  //%20${release.releaseTitle}
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Authorization": "Bearer " + spotifyToken
        }
      })

      const items = spotifyData.data.tracks.items
      console.log(items)
      if (items.length > 0) {
        let uri = items[0].uri
        if (uri) { spotifyURIs.push(uri) }
      }
    }
    return spotifyURIs
  }

  // Clear spotify token from window. TODO: Log out from spotify as well?
  function logout() {
    getSpotifyTokenFromWindow()
    window.localStorage.removeItem("token")
    alert('You have been logged out of Spotify')
    window.location.reload()
  }

  // Toggle HTML dark/light theme ID
  function toggleTheme(){
    setTheme((curr)=> (curr === "light" ? "dark" : "light") )
  }

  // Sets spotify auth token state from url (window.location)
  async function getSpotifyTokenFromWindow(){
    const hash = window.location.hash
    let token = window.localStorage.getItem("token")
    if (!token && hash) {
        token = hash.substring(1)
          .split("&")
          .find(elem => elem.startsWith("access_token"))
          .split("=")[1]
        window.location.hash = ""
        window.localStorage.setItem("token", token)
    }
    // return token
    setSpotifyToken(token)
  }

  // Gets user ID for creating an empty playlist
  async function getUserID(id){
    let userID = await axios("https://api.spotify.com/v1/me", {
      headers:{
        "Accept": "application/json", 
        "Content-Type": "application/json",
        "Authorization": "Bearer " + spotifyToken
      }
    })
    // setSpotifyUserID(userID)
    if (!id) {
      return userID.data.id
    } else if (id === 'full') {
      return userID.data
    }
  }

  // "ComponentDidMount" - sets spotify token from window on initial render
  useAsyncEffect(async () => {

    getSpotifyTokenFromWindow()
    if (spotifyToken) {

      // Promises
      getUserID("full").then((id) => {
        setSpotifyUsername(id.display_name)
      })

      // Async
      let userName = await getUserID("full")
      setSpotifyUsername(userName.display_name)
    }
  }, [spotifyToken])
  
  // JSX ================================================= //

  return (

    // ThemeContext bridges React's theme state to HTML's ID which is then read by CSS
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className="app padding" id={theme}>
        <div className="flex-row">
          <div>
            <h1 className="site-title">DiscoList</h1>
            
            {/* Dark mode switch */}
            <Form.Check 
              type="switch"
              id="darkmode-switch"
              label="Dark Mode"
              className="dark-mode-switch"
              size='lg'
              onChange={toggleTheme}
              checked={theme === "dark"}
            />
          </div>

          {/* Spotify login status + logout button */}
          {spotifyToken && 
            <div className="text-center spotify-login-container">
                <div>
                  <h6 id="logged-in-text">Logged into Spotify as</h6>
                  {typeof spotifyUsername == 'string' &&
                    <h6>{spotifyUsername}</h6>
                  }
                </div>
                {/* <div className="spacer"/> */}
                <Button variant="danger" size="sm" onClick={logout} id="spotify-logout-button">Log out</Button>
            </div>
          }
        </div>
          
        <br/>

        {/* Heading */}
        <h3 className="title-text">Type in a Record Label.</h3>
        <h5 className="subtitle-text">We'll turn it into a playlist.</h5>

        <br/>

        {/* Spotify login button */}
        {!spotifyToken && 
          <div className="text-center">
              <h4>To begin, click to log into your Spotify account:</h4>
              <br/>
              <Button variant="success" 
                size="lg"
                href={`${spotify_auth_endpoint}?client_id=${spotify_client_id}&redirect_uri=${spotify_redirect_uri}&response_type=${spotify_response_type}&scope=playlist-modify-private%20playlist-modify-public&response_type=token&show_dialogue=true`}>
                  Login to Spotify
              </Button>
          </div>
        }

        {/* User inputs */}
        <div className="centered inputs">
          {spotifyToken &&
           <InputForm 
              searchInputHandler={searchInputHandler}
              labelSearchInput={labelSearchInput}
              setQueryMaxHandler={setQueryMaxHandler}
              queryMax={queryMax} 
            />
          }
        </div>

        <br/>

        {/* Search and Create playlist button row */}
        {(spotifyToken && !isLoading && !spotifyIsCreating) &&
          <div>
            {/* Search button conditionally renders to enabled/disabled based on Spotify auth status */}
            <div className="flex-row flex-row-centered">
                <Button variant="primary" size="lg" onClick={searchButtonHandler} className="big-button">Search</Button>
                {tracklist && <Button variant="success" size="lg" onClick={createPlaylistHandler} className="big-button" id="create-playlist-button">Create Playlist</Button>}
            </div>
          </div>
        }
  
        {/* Discogs search loading spinner */}
        { (isLoading) &&
          <LoadingSpinner text='Loading...' color='blue'/>
        }

        {/* Spotify Playlist Create status indicator */}
        { (spotifyIsCreating) &&
          <LoadingSpinner text='Creating Spotify Playlist...' color='green'/>
        }

        <br/>

        {/* Tracklist display */}
        { (tracklist && spotifyToken) && 
          <Tracklist tracklist={tracklist}/>
        }

      </div>
    </ThemeContext.Provider>
  )
}

export default App