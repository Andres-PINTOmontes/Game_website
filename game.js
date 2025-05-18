// game.js - Lógica completa del juego integrada con HTML profesional
let ronda = 0;


// --- Clases y Estado del Juego ---
class Empresa {
  constructor() {
    this.margenGanancias = 0.30;
    this.costoProduccion = 5000;
    this.gastoOperacional = 2000;
    this.ingresosNetos = 100000;
    this.balance = 100000;
    this.bonificacionVentas = 1.0;
    this.rondasBonificacion = 0;
    this.limiteBonificaciones = 0;
  }
  calcularIngresoBase(casillas) {
    return 10000 * casillas;
  }
  actualizarIngresos(cantidad, tramoIVA = 0) {
    let ingreso = tramoIVA > 0 ? cantidad * (1 - tramoIVA/100) : cantidad;
    if (this.rondasBonificacion > 0 && this.limiteBonificaciones <= 0) ingreso *= this.bonificacionVentas;
    this.ingresosNetos += ingreso;
    this.balance += ingreso;
    if (this.rondasBonificacion > 0) {
      this.rondasBonificacion--;
      if (this.rondasBonificacion === 0) this.bonificacionVentas = 1.0;
    }
    if (this.limiteBonificaciones > 0) this.limiteBonificaciones--;
    return ingreso;
  }
  pagarGastos(cantidad) {
    this.balance -= cantidad;
    return this.balance >= 0;
  }
  estado() {
    let texto = `🌟 Margen: ${(this.margenGanancias*100).toFixed(2)}%\n` +
                `💼 Costo Prod: $${this.costoProduccion}\n` +
                `🛠️ Gasto Op: $${this.gastoOperacional}\n` +
                `💵 Ingresos: $${this.ingresosNetos}\n` +
                `💰 Balance: $${this.balance}\n`;
    if (this.rondasBonificacion>0) texto += `🚀 +${((this.bonificacionVentas-1)*100).toFixed(0)}% ventas x${this.rondasBonificacion} rondas\n`;
    if (this.limiteBonificaciones>0) texto += `⚠️ Bonifs limitadas: ${this.limiteBonificaciones} rondas\n`;
    return texto;
  }
}

class Jugador {
  constructor(nombre) {
    this.nombre = nombre;
    this.empresa = new Empresa();
    this.posicion = 0;
    this.lastRoll = 0;
    this.turnosPerdidos = 0;
    this.segurosRestantes = 0;
    this.ultimoIngreso = 0;
  }
  mostrarEstado() {
    let estado = `📍 Casilla ${this.posicion} (IVA: ${getTramoIVA(this.posicion)}%)\n` + this.empresa.estado();
    if (this.turnosPerdidos>0) estado += `⏱️ Turnos perdidos: ${this.turnosPerdidos}\n`;
    if (this.segurosRestantes>0) estado += `🛡️ Seguros: ${this.segurosRestantes}\n`;
    return estado;
  }
}

// --- Tablero ---
function crearTablero() {
  const t = {};
  for (let i=0; i<64; i++) {
    t[i] = { icon: '⬜', tipo: 'normal', indiceEfecto: null };
  }
  const esquinas = {0:'💥',16:'💰',32:'💎',48:'🚀'};
  Object.keys(esquinas).forEach(i=> t[i] = { icon: esquinas[i], tipo:'especial', indiceEfecto:null });
  const opp=[1,4,7,10,13,17,20,23,26,29,33,36,39,42,45,49,52,55,58,61];
  opp.forEach((c,i)=> t[c]={icon:'🎁',tipo:'oportunidad',indiceEfecto:i});
  const threats=[3,6,9,12,15,19,22,25,28,31,35,38,41,44,47,51,54,57,60,63];
  threats.forEach((c,i)=> t[c]={icon:'⚠️',tipo:'amenaza',indiceEfecto:i});
  return t;
}
function getTramoIVA(c){if(c<=16)return 5;if(c<=32)return 10;if(c<=48)return 15;return 30;}
const tablero = crearTablero();
let jugador=null,gameOver=false,esperandoDecision=false,casillaActual=null;

// --- UI Helpers ---
function clearDialog(){document.getElementById('dialog-container').innerHTML='';}
function showOutput(html){document.getElementById('output').innerHTML=html;}

// --- Render Tablero y Dashboard ---
// Elimina la función de renderizado del tablero, ya no es necesaria
// function actualizarTablero(){ ... }

// Solo actualiza el dashboard de la empresa y la posición del jugador en el nuevo panel creativo
function actualizarEmpresaDashboard(){
  if(!jugador)return;
  const cm=document.getElementById('company-metrics');
  cm.innerHTML=jugador.empresa.estado().replace(/\n/g,'<br>');
  // Actualiza la posición del jugador si tienes un panel o elemento específico para mostrarla
  // Por ejemplo, si tienes un elemento con id="player-pos", puedes hacer:
  // document.getElementById('player-pos').textContent = `Casilla: ${jugador.posicion}`;
}

// --- Inicio y Turno ---
function initJuego(){
  const nombre=document.getElementById('nombre').value.trim();
  if(!nombre){showOutput('❗ Ingresa nombre.');return;}
  jugador=new Jugador(nombre);gameOver=false;esperandoDecision=false;clearDialog();
  document.getElementById('juego').style.display='flex';
  showOutput(`🎮 Bienvenido ${nombre}!<br>`+jugador.mostrarEstado().replace(/\n/g,'<br>'));
  // Elimina la llamada a actualizarTablero();
  actualizarEmpresaDashboard();
}
function turno() {
  // 0) Incrementar y mostrar encabezado de ronda
  //ronda++;
  //showOutput(`--- Ronda ${ronda} ---`);

  // 1) Validaciones iniciales
  if (!jugador) {
    showOutput('Primero inicia juego.');
    return;
  }
  if (gameOver) {
    showOutput('Juego terminado.');
    return;
  }
  if (esperandoDecision) {
    return;
  }

  // 2) Turnos perdidos
  if (jugador.turnosPerdidos > 0) {
    jugador.turnosPerdidos--;
    showOutput(`⏱️ Pierdes ${jugador.turnosPerdidos} turno(s).`);
    return;
  }

  // 3) Leer y validar dado
  const v = parseInt(document.getElementById('dado').value);
  if (isNaN(v) || v < 1 || v > 6) {
    showOutput('❗ Dado 1-6');
    return;
  }

  // 4) Avanzar y calcular ingreso
  clearDialog();
  const prev = jugador.posicion;
  let np = prev + v;
  if (np >= 64) {
    np = 64;
    gameOver = true;
  }

  const ingres = jugador.empresa.calcularIngresoBase(np - prev);
  const neto  = jugador.empresa.actualizarIngresos(ingres, getTramoIVA(np));
  jugador.ultimoIngreso = neto;
  jugador.posicion      = np;
  jugador.lastRoll      = v;

  showOutput(`🎲 ${jugador.nombre} avanza a ${np}, gana $${neto.toFixed(0)}`);

  // 5) Actualizar UI
  // Elimina la llamada a actualizarTablero();
  actualizarEmpresaDashboard();

  // 6) Victoria
  if (np === 64) {
    showOutput('🏆 ¡Victoria!');
    return;
  }

  // 7) Procesar efecto de casilla
  setTimeout(() => {
    const cell = tablero[jugador.posicion];
    if      (cell.tipo === 'oportunidad') procesarCasillaOportunidad(cell);
    else if (cell.tipo === 'amenaza')      procesarCasillaAmenaza(cell);
    else                                   showOutput(jugador.mostrarEstado().replace(/\n/g,'<br>'));
  }, 300);
}

// --- Oportunidades con confirmación inline ---
function clearDialog() {
  document.getElementById('dialog-container').innerHTML = '';
}

// Llamar esta función al caer en una casilla de oportunidad
function procesarCasillaOportunidad(casilla) {
  const idx = casilla.indiceEfecto;
  efectosOpp[idx]();
}

// Array de funciones que muestran su propio diálogo y confirman antes de aplicar el efecto
const efectosOpp = [
  // 0: Casilla 1 - Desarrollo de Nuevo Producto
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>Desarrollo de Nuevo Producto</strong><br>Avanza 1 casilla extra.
        <div class="mt-3">
          <button id="ok-0" class="btn btn-success me-2">Tomar</button>
          <button id="no-0" class="btn btn-secondary">Pasar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-0').onclick = () => {
      clearDialog();
      jugador.posicion++;
      // actualizarTablero();
      actualizarEmpresaDashboard();
      showOutput('<strong>Desarrollo de Nuevo Producto:</strong> Avanzas 1 casilla extra.');
      esperandoDecision = false;
    };
    document.getElementById('no-0').onclick = () => {
      clearDialog(); showOutput('<em>Hecho: pasas oportunidad.</em>'); esperandoDecision = false;
    };
  },
  // 1: Casilla 4 - Tercerización en la Distribución
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>Tercerización en la Distribución</strong><br>Reduce gastos operacionales en un 2%.
        <div class="mt-3">
          <button id="ok-1" class="btn btn-success me-2">Tomar</button>
          <button id="no-1" class="btn btn-secondary">Pasar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-1').onclick = () => {
      clearDialog();
      jugador.empresa.gastoOperacional = Math.floor(jugador.empresa.gastoOperacional * 0.98);
      actualizarEmpresaDashboard();
      showOutput('<strong>Tercerización:</strong> Gastos operacionales -2%.');
      esperandoDecision = false;
    };
    document.getElementById('no-1').onclick = () => { clearDialog(); showOutput('<em>Pasas oportunidad.</em>'); esperandoDecision = false; };
  },
  // 2: Casilla 7 - Publicidad en Redes Sociales
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>Publicidad en RRSS</strong><br>Invierte $5,000 para ganar $15,000 adicionales.
        <div class="mt-3">
          <button id="ok-2" class="btn btn-success me-2">Tomar</button>
          <button id="no-2" class="btn btn-secondary">Pasar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-2').onclick = () => {
      clearDialog();
      if (jugador.empresa.balance >= 5000) {
        jugador.empresa.pagarGastos(5000);
        jugador.empresa.actualizarIngresos(15000);
        actualizarEmpresaDashboard();
        showOutput('<strong>Publicidad en RRSS:</strong> Ganaste $15,000.');
      } else showOutput('<strong>Publicidad RRSS:</strong> Fondos insuficientes.');
      esperandoDecision = false;
    };
    document.getElementById('no-2').onclick = () => { clearDialog(); showOutput('<em>Pasas oportunidad.</em>'); esperandoDecision = false; };
  },
  // 3: Casilla 10 - Campaña de Marketing
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>Campaña de Marketing</strong><br>Invierte $7,000 y lanza dos dados (elige mayor).
        <div class="mt-3">
          <button id="ok-3" class="btn btn-success me-2">Tomar</button>
          <button id="no-3" class="btn btn-secondary">Pasar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-3').onclick = () => {
      if (jugador.empresa.balance < 7000) {
        clearDialog(); showOutput('<strong>Campaña:</strong> Fondos insuficientes.'); esperandoDecision = false; return;
      }
      jugador.empresa.pagarGastos(7000);
      clearDialog();
      const dlg2 = `
        <div class="alert alert-info">
          Ingresa resultados de dos dados:<br>
          <input id="m1" type="number" min="1" max="6" placeholder="Dado1"><br>
          <input id="m2" type="number" min="1" max="6" placeholder="Dado2"><br>
          <button id="conf-3" class="btn btn-primary mt-2">Confirmar</button>
        </div>`;
      document.getElementById('dialog-container').innerHTML = dlg2;
      document.getElementById('conf-3').onclick = () => {
        const d1 = parseInt(document.getElementById('m1').value);
        const d2 = parseInt(document.getElementById('m2').value);
        if ([d1,d2].some(x=>isNaN(x)||x<1||x>6)) return alert('Dados 1-6');
        const mv = Math.max(d1,d2);
        jugador.posicion += mv;
        clearDialog();
        showOutput(`<strong>Campaña exitosa:</strong> Avanzas ${mv} casillas.`);
        actualizarTablero(); actualizarEmpresaDashboard();
        esperandoDecision = false;
      };
    };
    document.getElementById('no-3').onclick = () => { clearDialog(); showOutput('<em>Pasas oportunidad.</em>'); esperandoDecision = false; };
  },
  // 4: Casilla 13
  () => {
    clearDialog();
    const html = `<div class="alert alert-primary"><strong>Concurso Empresarial</strong><br> -15% Costo producción.<div class="mt-3"><button id="ok-4" class="btn btn-success me-2">Tomar</button><button id="no-4" class="btn btn-secondary">Pasar</button></div></div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-4').onclick = () => { clearDialog(); jugador.empresa.costoProduccion = Math.floor(jugador.empresa.costoProduccion * 0.85); actualizarEmpresaDashboard(); showOutput('<strong>Concurso:</strong> -15% costo producción.'); esperandoDecision = false; };
    document.getElementById('no-4').onclick = () => { clearDialog(); showOutput('<em>Pasas oportunidad.</em>'); esperandoDecision = false; };

  },
    // 5: Casilla 17 - Investigación y Desarrollo
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>Investigación y Desarrollo</strong><br>Invierte $19,000 para duplicar el retorno de tu último avance.
        <div class="mt-3">
          <button id="ok-5" class="btn btn-success me-2">Tomar</button>
          <button id="no-5" class="btn btn-secondary">Pasar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-5').onclick = () => {
      clearDialog();
      if (jugador.empresa.balance >= 19000) {
        jugador.empresa.pagarGastos(19000);
        jugador.empresa.actualizarIngresos(jugador.ultimoIngreso);
        actualizarEmpresaDashboard();
        showOutput(`<strong>I+D:</strong> Inviertes $19,000 y duplicas tu último ingreso: +$${jugador.ultimoIngreso}.`);
      } else {
        showOutput('<strong>I+D:</strong> Fondos insuficientes.');
      }
      esperandoDecision = false;
    };
    document.getElementById('no-5').onclick = () => { clearDialog(); showOutput('<em>Pasas oportunidad.</em>'); esperandoDecision = false; };
  },
  // 6: Casilla 20 - Inteligencia Artificial
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>Inteligencia Artificial</strong><br>Invierte $22,000 para reducir costos de producción en un 15%.
        <div class="mt-3">
          <button id="ok-6" class="btn btn-success me-2">Tomar</button>
          <button id="no-6" class="btn btn-secondary">Pasar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-6').onclick = () => {
      clearDialog();
      if (jugador.empresa.balance >= 22000) {
        jugador.empresa.pagarGastos(22000);
        jugador.empresa.costoProduccion = Math.floor(jugador.empresa.costoProduccion * 0.85);
        actualizarEmpresaDashboard();
        showOutput('<strong>IA:</strong> Inviertes $22,000 y -15% costos producción.');
      } else {
        showOutput('<strong>IA:</strong> Fondos insuficientes.');
      }
      esperandoDecision = false;
    };
    document.getElementById('no-6').onclick = () => { clearDialog(); showOutput('<em>Pasas oportunidad.</em>'); esperandoDecision = false; };
  },
  // 7: Casilla 23 - Optimización de Procesos
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>Optimización de Procesos</strong><br>Reduce costo de producción en un 5%.
        <div class="mt-3">
          <button id="ok-7" class="btn btn-success me-2">Tomar</button>
          <button id="no-7" class="btn btn-secondary">Pasar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-7').onclick = () => {
      clearDialog();
      jugador.empresa.costoProduccion = Math.floor(jugador.empresa.costoProduccion * 0.95);
      actualizarEmpresaDashboard();
      showOutput('<strong>Optimización:</strong> -5% costo producción.');
      esperandoDecision = false;
    };
    document.getElementById('no-7').onclick = () => { clearDialog(); showOutput('<em>Pasas oportunidad.</em>'); esperandoDecision = false; };
  },
  // 8: Casilla 26 - Feria Comercial
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>Feria Comercial</strong><br>Invierte $21,000 para ganar 3 casillas extra.
        <div class="mt-3">
          <button id="ok-8" class="btn btn-success me-2">Tomar</button>
          <button id="no-8" class="btn btn-secondary">Pasar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-8').onclick = () => {
      clearDialog();
      if (jugador.empresa.balance >= 21000) {
        jugador.empresa.pagarGastos(21000);
        jugador.posicion += 3;
        actualizarTablero(); actualizarEmpresaDashboard();
        showOutput('<strong>Feria Comercial:</strong> Avanzas 3 casillas.');
      } else {
        showOutput('<strong>Feria Comercial:</strong> Fondos insuficientes.');
      }
      esperandoDecision = false;
    };
    document.getElementById('no-8').onclick = () => { clearDialog(); showOutput('<em>Pasas oportunidad.</em>'); esperandoDecision = false; };
  },
  // 9: Casilla 29 - Asesoría Profesional
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>Asesoría Profesional</strong><br>Paga $6,000 para reducir costo de producción en un 10%.
        <div class="mt-3">
          <button id="ok-9" class="btn btn-success me-2">Tomar</button>
          <button id="no-9" class="btn btn-secondary">Pasar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-9').onclick = () => {
      clearDialog();
      if (jugador.empresa.balance >= 6000) {
        jugador.empresa.pagarGastos(6000);
        jugador.empresa.costoProduccion = Math.floor(jugador.empresa.costoProduccion * 0.90);
        actualizarEmpresaDashboard();
        showOutput('<strong>Asesoría:</strong> -10% costo producción.');
      } else {
        showOutput('<strong>Asesoría:</strong> Fondos insuficientes.');
      }
      esperandoDecision = false;
    };
    document.getElementById('no-9').onclick = () => { clearDialog(); showOutput('<em>Pasas oportunidad.</em>'); esperandoDecision = false; };
  },
  // 10: Casilla 33 - Sustentabilidad
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>Sustentabilidad</strong><br>Invierte $45,000 para recibir el 10% de tus ingresos netos.
        <div class="mt-3">
          <button id="ok-10" class="btn btn-success me-2">Tomar</button>
          <button id="no-10" class="btn btn-secondary">Pasar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-10').onclick = () => {
      clearDialog();
      if (jugador.empresa.balance >= 45000) {
        jugador.empresa.pagarGastos(45000);
        const inc = Math.floor(jugador.empresa.ingresosNetos * 0.10);
        jugador.empresa.actualizarIngresos(inc);
        actualizarEmpresaDashboard();
        showOutput(`<strong>Sustentabilidad:</strong> +$${inc}.`);
      } else {
        showOutput('<strong>Sustentabilidad:</strong> Fondos insuficientes.');
      }
      esperandoDecision = false;
    };
    document.getElementById('no-10').onclick = () => { clearDialog(); showOutput('<em>Pasas oportunidad.</em>'); esperandoDecision = false; };
  },
  // 11: Casilla 36 - Adquisición de Local
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>Adquisición de Local</strong><br>Paga $52,000 y reduce gastos operacionales en un 50%.
        <div class="mt-3">
          <button id="ok-11" class="btn btn-success me-2">Tomar</button>
          <button id="no-11" class="btn btn-secondary">Pasar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-11').onclick = () => {
      clearDialog();
      if (jugador.empresa.balance >= 52000) {
        jugador.empresa.pagarGastos(52000);
        jugador.empresa.gastoOperacional = Math.floor(jugador.empresa.gastoOperacional * 0.50);
        actualizarEmpresaDashboard();
        showOutput('<strong>Adquisición de Local:</strong> -50% gastos operacionales.');
      } else {
        showOutput('<strong>Adquisición de Local:</strong> Fondos insuficientes.');
      }
      esperandoDecision = false;
    };
    document.getElementById('no-11').onclick = () => { clearDialog(); showOutput('<em>Pasas oportunidad.</em>'); esperandoDecision = false; };
  },
  // 12: Casilla 39 - Mejora de Eficiencia
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>Mejora de Eficiencia</strong><br>Reduce gastos operacionales en un 6%.
        <div class="mt-3">
          <button id="ok-12" class="btn btn-success me-2">Tomar</button>
          <button id="no-12" class="btn btn-secondary">Pasar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-12').onclick = () => {
      clearDialog();
      jugador.empresa.gastoOperacional = Math.floor(jugador.empresa.gastoOperacional * 0.94);
      actualizarEmpresaDashboard();
      showOutput('<strong>Mejora de Eficiencia:</strong> -6% gastos operacionales.');
      esperandoDecision = false;
    };
    document.getElementById('no-12').onclick = () => { clearDialog(); showOutput('<em>Pasas oportunidad.</em>'); esperandoDecision = false; };
  },
  // 13: Casilla 42 - Alianza Estratégica
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>Alianza Estratégica</strong><br>Pierdes 1 turno y duplicas ingresos en la siguiente ronda.
        <div class="mt-3">
          <button id="ok-13" class="btn btn-success me-2">Tomar</button>
          <button id="no-13" class="btn btn-secondary">Pasar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-13').onclick = () => {
      clearDialog();
      jugador.turnosPerdidos++;
      jugador.empresa.bonificacionVentas = 2.0;
      jugador.empresa.rondasBonificacion = 1;
      actualizarEmpresaDashboard();
      showOutput('<strong>Alianza Estratégica:</strong> Pierdes 1 turno y duplicas ingresos siguiente ronda.');
      esperandoDecision = false;
    };
    document.getElementById('no-13').onclick = () => { clearDialog(); showOutput('<em>Pasas oportunidad.</em>'); esperandoDecision = false; };
  },
  // 14: Casilla 45 - Compra de Seguro
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>Compra de Seguro</strong><br>Paga $40,000 para protegerte de las próximas 3 amenazas.
        <div class="mt-3">
          <button id="ok-14" class="btn btn-success me-2">Tomar</button>
          <button id="no-14" class="btn btn-secondary">Pasar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-14').onclick = () => {
      clearDialog();
      if (jugador.empresa.balance >= 40000) {
        jugador.empresa.pagarGastos(40000);
        jugador.segurosRestantes += 3;
        actualizarEmpresaDashboard();
        showOutput('<strong>Compra de Seguro:</strong> Protección para 3 amenazas.');
      } else {
        showOutput('<strong>Compra de Seguro:</strong> Fondos insuficientes.');
      }
      esperandoDecision = false;
    };
    document.getElementById('no-14').onclick = () => { clearDialog(); showOutput('<em>Pasas oportunidad.</em>'); esperandoDecision = false; };
  },
  // 15: Casilla 49 - Devolución de Impuestos
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>Devolución de Impuestos</strong><br>Recibes el 10% de tus ingresos netos actuales.
        <div class="mt-3">
          <button id="ok-15" class="btn btn-success me-2">Tomar</button>
          <button id="no-15" class="btn btn-secondary">Pasar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-15').onclick = () => {
      clearDialog();
      const dev = Math.floor(jugador.empresa.ingresosNetos * 0.10);
      jugador.empresa.actualizarIngresos(dev);
      actualizarEmpresaDashboard();
      showOutput(`<strong>Devolución de Impuestos:</strong> +$${dev}.`);
      esperandoDecision = false;
    };
    document.getElementById('no-15').onclick = () => { clearDialog(); showOutput('<em>Pasas oportunidad.</em>'); esperandoDecision = false; };
  },
  // 16: Casilla 52 - Reinversión de Utilidades
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>Reinversión de Utilidades</strong><br>Invierte el 60% de tus utilidades para duplicar ingresos por 2 rondas.
        <div class="mt-3">
          <button id="ok-16" class="btn btn-success me-2">Tomar</button>
          <button id="no-16" class="btn btn-secondary">Pasar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-16').onclick = () => {
      clearDialog();
      const inv = Math.floor((jugador.empresa.ingresosNetos) * 0.60);
      if (jugador.empresa.balance >= inv) {
        jugador.empresa.pagarGastos(inv);
        jugador.empresa.bonificacionVentas = 2.0;
        jugador.empresa.rondasBonificacion = 2;
        actualizarEmpresaDashboard();
        showOutput('<strong>Reinversión de Utilidades:</strong> Duplica ingresos por 2 rondas.');
      } else {
        showOutput('<strong>Reinversión de Utilidades:</strong> Fondos insuficientes.');
      }
      esperandoDecision = false;
    };
    document.getElementById('no-16').onclick = () => { clearDialog(); showOutput('<em>Pasas oportunidad.</em>'); esperandoDecision = false; };
  },
  // 17: Casilla 55 - Expansión de Mercado
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>Expansión de Mercado</strong><br>Paga $60,000, ganas 2 casillas extra y +20% ventas por 3 rondas.
        <div class="mt-3">
          <button id="ok-17" class="btn btn-success me-2">Tomar</button>
          <button id="no-17" class="btn btn-secondary">Pasar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-17').onclick = () => {
      clearDialog();
      if (jugador.empresa.balance >= 60000) {
        jugador.empresa.pagarGastos(60000);
        jugador.posicion += 2;
        jugador.empresa.bonificacionVentas = 1.2;
        jugador.empresa.rondasBonificacion = 3;
        actualizarTablero(); actualizarEmpresaDashboard();
        showOutput('<strong>Expansión de Mercado:</strong> +2 casillas y +20% ventas x3 rondas.');
      } else {
        showOutput('<strong>Expansión de Mercado:</strong> Fondos insuficientes.');
      }
      esperandoDecision = false;
    };
    document.getElementById('no-17').onclick = () => { clearDialog(); showOutput('<em>Pasas oportunidad.</em>'); esperandoDecision = false; };
  },
  // 18: Casilla 58 - Registro de Marca
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>Registro de Marca</strong><br>Paga $50,000 para aumentar ventas un 80% por 1 ronda.
        <div class="mt-3">
          <button id="ok-18" class="btn btn-success me-2">Tomar</button>
          <button id="no-18" class="btn btn-secondary">Pasar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-18').onclick = () => {
      clearDialog();
      if (jugador.empresa.balance >= 50000) {
        jugador.empresa.pagarGastos(50000);
        jugador.empresa.bonificacionVentas = 1.8;
        jugador.empresa.rondasBonificacion = 1;
        actualizarEmpresaDashboard();
        showOutput('<strong>Registro de Marca:</strong> +80% ventas x1 ronda.');
      } else {
        showOutput('<strong>Registro de Marca:</strong> Fondos insuficientes.');
      }
      esperandoDecision = false;
    };
    document.getElementById('no-18').onclick = () => { clearDialog(); showOutput('<em>Pasas oportunidad.</em>'); esperandoDecision = false; };
  },
  // 19: Casilla 61 - Programa de Fidelización
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>Programa de Fidelización</strong><br>Paga $55,000 para aumentar ventas un 15% por 3 rondas.
        <div class="mt-3">
          <button id="ok-19" class="btn btn-success me-2">Tomar</button>
          <button id="no-19" class="btn btn-secondary">Pasar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-19').onclick = () => {
      clearDialog();
      if (jugador.empresa.balance >= 55000) {
        jugador.empresa.pagarGastos(55000);
        jugador.empresa.bonificacionVentas = 1.15;
        jugador.empresa.rondasBonificacion = 3;
        actualizarEmpresaDashboard();
        showOutput('<strong>Programa de Fidelización:</strong> +15% ventas x3 rondas.');
      } else {
        showOutput('<strong>Programa de Fidelización:</strong> Fondos insuficientes.');
      }
      esperandoDecision = false;
    };
    document.getElementById('no-19').onclick = () => { clearDialog(); showOutput('<em>Pasas oportunidad.</em>'); esperandoDecision = false; };
  }
];






// --- Efectos para Casillas de Amenaza (índices 0–19) ---
const efectosAmen = [
  // Casilla 3: Inspección Fiscal. Pierdes 2 turnos.
  () => {
    jugador.turnosPerdidos += 2;
    showOutput(`<strong>Inspección Fiscal</strong><br>Pierdes 2 turnos.`);
  },
  // Casilla 6: Retraso Logístico. Retrocedes 1 casilla.
  () => {
    jugador.posicion = Math.max(0, jugador.posicion - 1);
    // actualizarTablero(); // Eliminar esta línea
    actualizarEmpresaDashboard();
    showOutput(`<strong>Retraso Logístico</strong><br>Retrocedes 1 casilla.`);
  },
  // Casilla 9: Reparación de Maquinaria. Pierdes $10,000 y +5% costo producción.
  () => {
    if (jugador.empresa.balance >= 10000) {
      jugador.empresa.pagarGastos(10000);
      jugador.empresa.costoProduccion = Math.floor(jugador.empresa.costoProduccion * 1.05);
      actualizarEmpresaDashboard();
      showOutput(`<strong>Reparación de Maquinaria</strong><br>Pagas $10,000 y costo de producción +5%.`);
    } else {
      showOutput(`<strong>Reparación de Maquinaria</strong><br>No tienes $10,000. ¡GAME OVER!`);
      gameOver = true;
    }
  },
  // Casilla 12: Fallo en el Sistema de Ventas. Pierdes 5% de bonificaciones de ventas por 2 rondas.
  () => {
    jugador.empresa.bonificacionVentas *= 0.95;
    jugador.empresa.rondasBonificacion = Math.max(jugador.empresa.rondasBonificacion, 2);
    actualizarEmpresaDashboard();
    showOutput(`<strong>Fallo en Sistema de Ventas</strong><br>Pierdes 5% de bonificaciones x2 rondas.`);
  },
  // Casilla 15: Paro de Producción. Retrocedes 1 casilla y bonificaciones limitadas por 4 rondas.
  () => {
    jugador.posicion = Math.max(0, jugador.posicion - 1);
    jugador.empresa.limiteBonificaciones = 4;
    actualizarTablero();
    actualizarEmpresaDashboard();
    showOutput(`<strong>Paro de Producción</strong><br>Retrocedes 1 casilla y bonificaciones limitadas por 4 rondas.`);
  },
  // Casilla 19: Normativas y Regulaciones. Lanza un dado; +5% costo producción por cada punto.
  () => {
    clearDialog();
    document.getElementById('dialog-container').innerHTML = `
      <div class="alert alert-warning">
        <strong>Normativas y Regulaciones</strong><br>
        Ingresa el resultado de tu dado físico:<br>
        <input type="number" id="dreg" class="form-control mb-2" min="1" max="6" placeholder="Dado">
        <button id="conf-reg" class="btn btn-primary">Confirmar</button>
      </div>`;
    esperandoDecision = true;
    document.getElementById('conf-reg').onclick = () => {
      const v = parseInt(document.getElementById('dreg').value);
      if (isNaN(v) || v < 1 || v > 6) return alert('Ingresa un valor entre 1 y 6.');
      jugador.empresa.costoProduccion = Math.floor(jugador.empresa.costoProduccion * (1 + 0.05 * v));
      clearDialog();
      actualizarEmpresaDashboard();
      showOutput(`<strong>Normativas y Regulaciones</strong><br>Costo de producción +${5 * v}%`);
      esperandoDecision = false;
    };
  },
  // Casilla 22: Sanción por Incumplimiento. Retrocedes 2 casillas y pierdes 2 turnos.
  () => {
    jugador.posicion = Math.max(0, jugador.posicion - 2);
    jugador.turnosPerdidos += 2;
    actualizarTablero();
    showOutput(`<strong>Sanción por Incumplimiento</strong><br>Retrocedes 2 casillas y pierdes 2 turnos.`);
  },
  // Casilla 25: Competencia Desleal. Pierdes 5% de margen de ganancia.
  () => {
    jugador.empresa.margenGanancias *= 0.95;
    actualizarEmpresaDashboard();
    showOutput(`<strong>Competencia Desleal</strong><br>Margen de ganancia -5%.`);
  },
  // Casilla 28: Aumento de Materia Prima. Aumenta +5% costo producción.
  () => {
    jugador.empresa.costoProduccion = Math.floor(jugador.empresa.costoProduccion * 1.05);
    actualizarEmpresaDashboard();
    showOutput(`<strong>Aumento de Materia Prima</strong><br>Costo de producción +5%.`);
  },
  // Casilla 31: Problema de Calidad. Retrocedes 2 casillas.
  () => {
    jugador.posicion = Math.max(0, jugador.posicion - 2);
    // actualizarTablero();
    actualizarEmpresaDashboard();
    showOutput(`<strong>Problema de Calidad</strong><br>Retrocedes 2 casillas.`);
  },
  // Casilla 35: Incendio en Planta. Retrocedes 3 casillas y pierdes 3 turnos.
  () => {
    jugador.posicion = Math.max(0, jugador.posicion - 3);
    jugador.turnosPerdidos += 3;
    // actualizarTablero();
    actualizarEmpresaDashboard();
    showOutput(`<strong>Incendio en Planta</strong><br>Retrocedes 3 casillas y pierdes 3 turnos.`);
  },
  // Casilla 38: Fraude Interno. Pierdes USD 30,000 de ingresos netos.
  () => {
    if (jugador.empresa.balance >= 30000) {
      jugador.empresa.pagarGastos(30000);
      actualizarEmpresaDashboard();
      showOutput(`<strong>Fraude Interno</strong><br>Pierdes $30,000.`);
    } else {
      showOutput(`<strong>Fraude Interno</strong><br>No puedes cubrir $30,000. ¡GAME OVER!`);
      gameOver = true;
    }
  },
  // Casilla 41: Avería de Maquinaria. Lanza un dado; retrocedes ese número y pagas $10,000 por casilla.
  () => {
    clearDialog();
    document.getElementById('dialog-container').innerHTML = `
      <div class="alert alert-danger">
        <strong>Avería de Maquinaria</strong><br>
        Ingresa el resultado de tu dado físico:<br>
        <input type="number" id="dav" class="form-control mb-2" min="1" max="6" placeholder="Dado">
        <button id="conf-av" class="btn btn-primary">Confirmar</button>
      </div>`;
    esperandoDecision = true;
    document.getElementById('conf-av').onclick = () => {
      const v = parseInt(document.getElementById('dav').value);
      if (isNaN(v) || v < 1 || v > 6) return alert('Ingresa un valor entre 1 y 6.');
      jugador.posicion = Math.max(0, jugador.posicion - v);
      const costo = v * 10000;
      if (!jugador.empresa.pagarGastos(costo)) { showOutput('No tienes para pagar reparaciones. ¡GAME OVER!'); gameOver = true; }
      else { actualizarEmpresaDashboard(); showOutput(`<strong>Avería de Maquinaria</strong><br>Retrocedes ${v} casillas y pagas $${costo}.`); }
      // actualizarTablero();
      esperandoDecision = false;
    };
  },
  // Casilla 44: Pérdida de Contrato. Pierdes 10% de tus ingresos netos.
  () => {
    const ded = Math.floor(jugador.empresa.ingresosNetos * 0.10);
    jugador.empresa.ingresosNetos -= ded;
    jugador.empresa.balance -= ded;
    actualizarEmpresaDashboard();
    showOutput(`<strong>Pérdida de Contrato</strong><br>Pierdes 10% ingresos netos: -$${ded}.`);
  },
  // Casilla 47: Inflación. Aumenta +15% costo producción.
  () => {
    jugador.empresa.costoProduccion = Math.floor(jugador.empresa.costoProduccion * 1.15);
    actualizarEmpresaDashboard();
    showOutput(`<strong>Inflación</strong><br>Costo de producción +15%.`);
  },
  // Casilla 51: Multa por Incumplimiento. Pierdes 15% ingresos netos y 1 turno.
  () => {
    const ded = Math.floor(jugador.empresa.ingresosNetos * 0.15);
    jugador.empresa.ingresosNetos -= ded;
    jugador.empresa.balance -= ded;
    jugador.turnosPerdidos++;
    actualizarEmpresaDashboard();
    showOutput(`<strong>Multa por Incumplimiento</strong><br>Pierdes 15% ingresos netos (-$${ded}) y 1 turno.`);
  },
  // Casilla 54: Cancelación de Campaña. Pierdes 10% de bonificaciones de ventas.
  () => {
    jugador.empresa.bonificacionVentas *= 0.90;
    actualizarEmpresaDashboard();
    showOutput(`<strong>Cancelación de Campaña</strong><br>Pierdes 10% de tus bonificaciones de ventas.`);
  },
  // Casilla 57: Subida de Costes Energéticos. Aumenta +10% costo producción.
  () => {
    jugador.empresa.costoProduccion = Math.floor(jugador.empresa.costoProduccion * 1.10);
    actualizarEmpresaDashboard();
    showOutput(`<strong>Costes Energéticos</strong><br>Costo de producción +10%.`);
  },
  // Casilla 60: Crisis Mayor. Pierdes 2 turnos y retrocedes al inicio.
  () => {
    jugador.posicion = 0;
    jugador.turnosPerdidos += 2;
    // actualizarTablero();
    actualizarEmpresaDashboard();
    showOutput(`<strong>Crisis Mayor</strong><br>Pierdes 2 turnos y vuelves al inicio.`);
  },
  // Casilla 63: Devaluación de Activos. Pierdes 10% margen de ganancia y 1 turno.
  () => {
    jugador.empresa.margenGanancias *= 0.90;
    jugador.turnosPerdidos++;
    actualizarEmpresaDashboard();
    showOutput(`<strong>Devaluación de Activos</strong><br>Pierdes 10% margen de ganancia y 1 turno.`);
  }
];

function procesarCasillaOportunidad(cas){esperandoDecision=false;clearDialog();efectosOpp[cas.indiceEfecto]();actualizarEmpresaDashboard();}
function procesarCasillaAmenaza(cas){esperandoDecision=false;clearDialog();efectosAmen[cas.indiceEfecto]();actualizarEmpresaDashboard();}

// --- DOM Ready ---
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('btn-iniciar').addEventListener('click',initJuego);
  document.getElementById('btn-turno').addEventListener('click',turno);

  // Si tienes los botones de dado aleatorio y limpiar log, descomenta estas líneas:
  // document.getElementById('btn-random-dice').addEventListener('click',()=>document.getElementById('dado').value=Math.ceil(Math.random()*6));
  // document.getElementById('btn-clear-log').addEventListener('click',()=>showOutput(''));
});
