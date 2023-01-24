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

  constructor(coords, distance, duration) {
    this.coords = coords;
    this.distance = distance;
    this.duration = duration;
  }

  setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
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

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
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

  constructor() {
    // Get position
    this.#getPosition();

    // Load Map
    this.#loadMap();

    // Get data from local storage
    this.#getLocalStorage();

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

  async #getPosition() {
    if (navigator.geolocation);
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject);
    });
  }

  async #loadMap() {
    const position = await this.#getPosition();
    const { latitude, longitude } = position.coords;
    const coords = [latitude, longitude];
    console.log(coords);

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
  }

  #showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
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

      workout = new Running([lat, lng], distance, duration, cadence);
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

      workout = new Cycling([lat, lng], distance, duration, elevation);
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
    console.log(this.#workOuts);
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

    console.log(this.#workouts);
  }

  #setLocalStorage() {
    // Local storage is an API that is being provided by the browser for us.
    // To set an item on the localstorage we use write localstorage which is a keyword and we call the setItem method on it. The method takes in two argument the second which would act as a value and the first a key. Local storage acts as a key value store.

    // Local storage is a small api ant it's adviced to use for small data handling because using it to store large amount of data would slow down your application.

    localStorage.setItem('workouts', JSON.stringify(this.#workouts)); // WE use JSON stringify to convert the object into a string so it can be saved in the localStorage.
  }

  #getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => {
      this.#renderWorkout(work);
    });

    // console.log(this.#workouts);

    // The objects coming from localStorage would not inherit the methods it has before being saved to loval storage
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
