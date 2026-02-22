import Alpine from 'alpinejs'
import { createScoreboard } from './game'
import '@picocss/pico/css/pico.min.css'
import './style.css'

Alpine.data('scoreboard', createScoreboard)

Alpine.start()
