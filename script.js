'use strict';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const deleteButton = document.querySelector('.delete');
const ctaInputType = document.querySelector('.cta__input--type');

// PROJECT PLANNING

/* 
    User stories: a description of the app functionality from the user perspective. it is the high level overview of the whole application which allows the devs to determine the exact the features to implement to make the user stories work as intended. All the user stories put together forms or describes the whole application

    Features: 

    FlowChart: Visualizing the different actions that user can take and how the application reacts to these actions and they are put in a FlowChart. (what we will build). What the program should do not how it does it

    Architecture: Talks about how we would build the application. In this context architecture means how we would organize our code and which JS features we would use. It is what holds all the code todether giving us structure in which we can develop the app functionality

    If we don't think about application before we write our code we could end up with a mess of unmanagable spagetti code

    Development: Implementing our plan using code

    WRITING USER STORIES: THERE ARE SO MANY WAYS OF WRITING USER STORIES BUT THE MOST POPULAR IS WRITING SENTENCES IN THIS FORMAT:
    As a [type of user], i want [an action] so that [benefit]. This answers the question who, what and why
    type -  of user let's us determine which type of user it is 
    action - allow us to know what kind of action the user wants to carry out
    benefit - allows us to understand the result of the action taken by the user
*/

// Constructor function is called immediately a new object is created out from a class

// GeoLocation API
/* 
  The geolocation api is one of the api that the browser gives to us. It takes two call back functions. The first is the callback function that will be called on success when the browser gets the current location of the user and the second callback is the error callback that'll be called when the browser doesn't get the current location. 

  The first callback takes an parameter known as the position parameter
*/

let map, mapEvent, mapLayer, popups;

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);

  constructor(coords, distance, duration, city, country, weatherData) {
    this.coords = coords;
    this.distance = distance;
    this.duration = duration;
    this.city = city;
    this.country = country;
    this.weatherData = weatherData;
  }

  setDescription() {
    // prettier-ignore
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    let setType;

    if (this.type === 'running') {
      setType = this.type[0].toUpperCase() + this.type.slice(1, 3);
    } else {
      setType = this.type[0].toUpperCase() + this.type.slice(1, 4) + 'e';
    }

    this.description = `${setType} in ${this.city}, ${this.country} on ${
      months[this.date.getMonth()]
    }  ${this.date.getDate()} (${this.weatherData})`;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, city, country, weatherData, cadence) {
    super(coords, distance, duration, city, country, weatherData);
    this.cadence = cadence;
    this.calcPace();
    this.setDescription();
  }

  calcPace() {
    return (this.pace = this.duration / this.distance);
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(
    coords,
    distance,
    duration,
    city,
    country,
    weatherData,
    elevationGain
  ) {
    super(coords, distance, duration, city, country, weatherData);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this.setDescription();
  }

  calcSpeed() {
    // km/hr
    return (this.speed = this.distance / (this.duration / 60));
  }
}
// const run1 = new Running([38, 12], 5.2, 24, 178);
// const cycle1 = new Cycling([38, 12], 27, 95, 523);
// console.log(run1, cycle1);

// Application
class App {
  #map;
  #mapEvent;
  #mapLayer;
  #workouts = [];
  #mapZoomLevel = 17;
  #workOuts;
  #position;
  #weatherData;

  constructor() {
    // Get position
    this.#getPosition();

    // Get data from local storage
    this.#getLocalStorage();

    // Show Message
    this.#showMessage();

    // Attach event listener
    form.addEventListener('submit', this.#newWorkout.bind(this));
    inputType.addEventListener('change', this.#toggleElevationField);

    // containerWorkouts.addEventListener('click', this.#moveToPopup.bind(this));
    containerWorkouts.addEventListener('click', e => {
      const trashBin = e.target.closest('.trash');

      if (!trashBin) return this.#moveToPopup(e);

      const workoutEl = e.target.closest('.workout');
      if (!workoutEl) return;
      this.#deleteItem(workoutEl);
    });

    // Delete button
    deleteButton.addEventListener('click', this.#reset.bind(this));

    // Sort
    ctaInputType.addEventListener('click', this.#sortWorkout.bind(this));
  }

  #getPosition() {
    if (navigator.geolocation);

    navigator.geolocation.getCurrentPosition(
      position => {
        // Success callback
        this.#loadMap(position);
      },
      error => {
        // Error callback
        console.log(error);
      }
    );
  }

  #loadMap(position) {
    const { latitude, longitude } = position.coords;
    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel); // map is the result of calling leaflet.map

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map); // Code handling tiling

    // Handling clicks on map
    this.#map.on('click', this.#showForm.bind(this));

    // Rendering the object gotten from local storage after the map has been loaded
    this.#workouts.forEach(work => {
      this.#renderWorkoutMarker(work);
    });

    this.#getCountry(position).then(data => {
      this.#position = data;
    });

    this.#getWeather(position);

    if (this.#workouts !== 0) return;
    this.#centerMap(this.#workouts);
  }

  #centerMap(workOuts) {
    let bounds = [];
    workOuts.forEach(points => {
      bounds.push(points.coords);
    });

    this.#map.fitBounds(bounds);
  }

  #showForm(mapE) {
    this.#hideMessage();
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  #showMessage() {
    const html = `
    <p class="msg">Click anywhere on the Map to Log Workout. After logging workout, click on the workout to move to the marker on the map</p>
    `;

    containerWorkouts.insertAdjacentHTML('beforeend', html);
  }

  #hideMessage() {
    document.querySelector('.msg').remove();
  }

  #hideForm() {
    inputCadence.value =
      inputDistance.value =
      inputDuration.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');

    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  #toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  async #getCountry(position) {
    try {
      const { latitude: lat, longitude: lng } = position.coords;
      const data = await fetch(
        `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=ef814b2d6071423ab658fbcf6c48303d`
      );
      if (!data.ok) throw new Error('Problem Fetching Your Location Data');
      const response = await data.json();
      const dataProperties = response.features[0].properties;

      return dataProperties;
    } catch (error) {
      console.error(error.message);
      alert(error.message);
    }
  }

  #newWorkout(e) {
    e.preventDefault();

    const validInputs = (...inputs) =>
      inputs.every(input => Number.isFinite(input));

    const allPositive = (...inputs) => inputs.every(input => input >= 0);

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    const city = this.#position.city;
    const country = this.#position.country;
    let workout;

    // IF workout runnning, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;

      // CHeck if data is valid
      if ((!distance, !duration, !cadence)) return alert('Enter Values');
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        // if not true return the alert function
        return alert('Value must be a positive number');

      workout = new Running(
        [lat, lng],
        distance,
        duration,
        city,
        country,
        this.#weatherData,
        cadence
      );
    }

    // IF workout cycling, create running object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      // CHeck if data is valid
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('Value must be a positive number cycling');

      workout = new Cycling(
        [lat, lng],
        distance,
        duration,
        city,
        country,
        this.#weatherData,
        elevation
      );
    }
    this.#workouts.push(workout);

    // hide form
    this.#hideForm();

    // Display marker
    this.#renderWorkoutMarker(workout);

    // Render workout on list
    this.#renderWorkout(workout);

    // Set local storage to workout
    this.#setLocalStorage();

    this.#workOuts = this.#workouts;
  }

  #renderWorkoutMarker(workout) {
    const myIcon = L.icon({
      iconUrl: 'icon.png',
      iconSize: [40, 40],
      iconAnchor: [22, 20],
      popupAnchor: [-1, -15],
      className: `${workout.id}`,
    });

    this.#mapLayer = L.marker(workout.coords, { icon: myIcon })
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 150,
          autoClose: false,
          closeOnEscapeKey: false,
          closeOnClick: false,
          className: `${workout.type}-popup ${workout.id}`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♀️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup(); // Default code for adding marker to the map. .marker creates the marker and .addTo(map) adds to the map, .bindPopup creates a popup and binds it to the marker with a string.
  }

  #renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title"> ${workout.description}</h2>
        <span class="trash"><i class="fa-solid fa-trash icons-fa"></i></span>

        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♀️' : '🚴‍♀️'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running') {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>
      `;
    }

    if (workout.type === 'cycling') {
      html += `
         <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
        </li>
      `;
    }

    form.insertAdjacentHTML('afterend', html);
  }

  #moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  #setLocalStorage() {
    // Local storage is an API that is being provided by the browser for us.
    // To set an item on the localstorage we use write localstorage which is a keyword and we call the setItem method on it. The method takes in two argument the second which would act as a value and the first a key. Local storage acts as a key value store.

    // Local storage is a small api ant it's adviced to use for small data handling because using it to store large amount of data would slow down your application.

    // store data in local storage
    localStorage.setItem('workouts', JSON.stringify(this.#workouts)); // WE use JSON stringify to convert the object into a string so it can be saved in the localStorage.
  }

  async #getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;
    this.#workouts.forEach(work => {
      this.#renderWorkout(work);
    });

    // The objects coming from localStorage would not inherit the methods it has before being saved to loval storage
  }

  async #getWeather(position) {
    try {
      const { latitude: lat, longitude: lng } = position.coords;
      const weather = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=52e092eb7fe556f72f119a9bc9fdb038`
      );

      const response = await weather.json();
      const degree = response.main.temp - 273.15;
      this.#weatherData = `${degree.toFixed(1)}℃`;
    } catch (error) {
      console.error(error);
    }
  }

  #sortWorkout() {
    this.#reset();
    const type = ctaInputType.value;

    if (!this.#workOuts) return;

    if (type === 'distance') {
      this.#workOuts.sort((a, b) => b.distance - a.distance);
      this.#workouts = this.#workOuts;
      this.#workouts.forEach(work => {
        this.#renderWorkout(work);
        this.#renderWorkoutMarker(work);
      });
    }

    if (type === 'duration') {
      this.#workOuts.sort((a, b) => a.duration - b.duration);
      this.#workouts = this.#workOuts;
      this.#workouts.forEach(work => {
        this.#renderWorkout(work);
      });
    }
  }

  #clearPopupAndMarker() {
    const popups = document.querySelectorAll('.leaflet-popup');
    const marker = document.querySelectorAll('.leaflet-marker-pane');
    const markerShadow = document.querySelectorAll('.leaflet-shadow-pane');

    popups.forEach(popup => popup.remove());
    marker.forEach(mark => mark.remove());
    markerShadow.forEach(shadow => shadow.remove());
  }

  #reset() {
    const workoutContainer = document.querySelectorAll('.workout');

    this.#workouts = [];
    localStorage.removeItem('workouts');
    workoutContainer.forEach(workout => workout.remove());
    this.#clearPopupAndMarker();
    // location.reload(); // Localtion is a big object that has a lot of methods and properties in the browser.
  }

  #deleteItem(element) {
    this.#workouts.splice(
      this.#workouts.findIndex(el => el.id === element.dataset.id)
    );
    this.#setLocalStorage();
    element.remove();

    const popups = [...document.querySelectorAll('.leaflet-popup')];
    popups
      .find(popup => popup.className.includes(`${element.dataset.id}`))
      .remove();

    const marker = [...document.querySelectorAll('.leaflet-marker-icon')];
    marker
      .find(mark => mark.className.includes(`${element.dataset.id}`))
      .remove();
  }
}
// Through the scope chain the constructor function will get access to all the the methods of the parent class
const app = new App();

/* Tasks:
  Ability to edit a workout;
  Ability to delete a workout;
  Ability to delete all workouts;
  Ability to sort workouts by a certain field (e.g. distance);
  Re-build Running and Cycling objects coming from Local Storage;
  More realistic error and confirmation messages;
  Ability to position the map to show all workouts [very hard];
  Ability to draw lines and shapes instead of just points [very hard]
*/

// Testing for old browsers

// To be able to ascertain where a click was made on the map an event listener is to be used and this event listener isn't the regular JS EL but rather a built in Event listener(method) in the Leaflet library. The map object is an object generated by a leaflet because of the L. And this object can take methods on.

// Just Like the JS event listener the leaflet event listener takes in the type of event to listen for and a callback function and when the callback function is called by leaflet it does so with an event (an event created by leaflet is accessed)

//////////////////////////////////////////////////////////////////////////////////////////

// GeoLocation API
// The GeoLocation ApI is called an API it's an API that the browser gives us and it's a modern API.

// navigator.geolocation.getCurrentPosition(
//   function (position) {
//     // The position parameter returns an object which contains the cordinates and we can destructure that object to get the cordinates which we need.
//     const { latitude, longitude } = position.coords;
//     console.log(`https://www.google.com/maps/@${latitude},${longitude}`); // We will then use these cordinates to load the map and center it at this position.

//     const map = L.map('map').setView([51.505, -0.09], 13); // whatever string we pass into the map function must be the id of an element in out html and it is in that element that the map will be displayed. L is a main function that leaflet gives us as an entry point, it is a namespace

//     L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
//       attribution:
//         '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
//     }).addTo(map);

//     L.marker([51.5, -0.09])
//       .addTo(map)
//       .bindPopup('A pretty CSS3 popup.<br> Easily customizable.')
//       .openPopup();
//   },
//   function () {
//     alert('Error getting cordinates');
//   }
// );
// The callback function above takes in two parameters, first the success parameter that'll be called when the browser gets the cordinates successively and the error parameter when the browser fails to get the current position.

// The success callback function is called with a parameter known as the position parameter.

// To make sure we do not get errors on old browsers we check if the navigator.geolocation before we run the navigator code.

////////////////////////////////////////////////////
// Loading a Map using Third Party Library (LeafLet)

/* 

The frst thing we do is to include the script tag of the library in our page. And we assign the defer attribute to it so it gets downloaded before out script. And then we make use of the functions defined in the library to make it work.
 */
