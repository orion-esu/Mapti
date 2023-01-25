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

// let map, mapEvent, mapLayer, popups;

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
  #geoLocationPosition;

  constructor() {
    // Get position
    this.#getPosition();

    // Consume Promise
    this.#consumePromise();

    // Get data from local storage
    this.#getLocalStorage();

    // Attach event listener
    form.addEventListener('submit', this.#newWorkout.bind(this));
    inputType.addEventListener('change', this.#toggleElevationField);

    containerWorkouts.addEventListener('click', e => {
      const trashBin = e.target.closest('.trash');

      if (!trashBin) return this.#moveToPopup(e);

      const workoutEl = e.target.closest('.workout');
      if (!workoutEl) return;
      this.#deleteItem(workoutEl);
    });

    // Show Message
    if (this.#workouts.length !== 0) return;
    this.#showMessage();

    // Delete button
    deleteButton.addEventListener('click', this.#reset.bind(this));

    // Sort
    ctaInputType.addEventListener('click', this.#sortWorkout.bind(this));
  }

  #getPosition() {
    if (navigator.geolocation)
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          position => resolve(position),
          error => reject(error)
        );
      });
  }

  #consumePromise() {
    this.#getPosition()
      .then(
        position => this.#loadMap(position) // Load Map using the fulfilled value of the promise
      )
      .catch(error => {
        // Throw Manual Error
        if (error.code === error.PERMISSION_DENIED) {
          throw new Error('Enable Location to use app');
        }
      })
      .catch(
        error => this.#errorMessage(error.message)
        // Display error on UI
      );
  }

  #loadMap(position) {
    const { latitude, longitude } = position.coords;
    const coords = [latitude, longitude];
    this.#geoLocationPosition = position;

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
    const msg = document.querySelector('.msg');

    if (!msg) return;
    msg.remove();
  }

  #errorMessage(msg) {
    const html = `
      <p class="error">${msg}😞</p>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
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
      if (!data.ok && data.status === 404)
        throw new Error('Problem Fetching Your Location Data');

      const response = await data.json();
      const dataProperties = response.features[0].properties;

      return dataProperties;
    } catch (error) {
      this.#errorMessage(error);
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

    // Get Weather
    this.#getWeather(this.#geoLocationPosition);
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
      .openPopup();
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
    // store data in local storage
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  #getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;
    this.#workouts.forEach(work => {
      this.#renderWorkout(work);
    });
  }

  async #getWeather(position) {
    try {
      const { latitude: lat, longitude: lng } = position.coords;
      const weather = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=52e092eb7fe556f72f119a9bc9fdb038`
      );
      if (!weather.ok && weather.status === 404)
        throw new Error('Problem Fetching Weather Data');

      const response = await weather.json();
      const degree = response.main.temp - 273.15;
      this.#weatherData = `${degree.toFixed(1)}℃`;
    } catch (error) {
      this.#errorMessage(error);
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
    location.reload();
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
const app = new App();
