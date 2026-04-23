import Alpine from 'alpinejs'
import { createScoreboard } from './game'
import './style.css'

Alpine.data('scoreboard', createScoreboard)

Alpine.start()
