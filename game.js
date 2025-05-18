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
  // Usa una imagen PNG para las oportunidades
  const opp=[1,4,7,10,13,17,20,23,26,29,33,36,39,42,45,49,52,55,58,61];
  opp.forEach((c,i)=> t[c]={icon:'<img src="assets/img/signopeso.png" alt="$" style="height:28px;width:auto;vertical-align:middle;">',tipo:'oportunidad',indiceEfecto:i});
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
function actualizarTablero(){
  const bc=document.getElementById('board-container'); bc.innerHTML='';
  const start=Math.max(0,jugador?jugador.posicion-8:0),end=Math.min(63,start+15);
  const grid=document.createElement('div'); grid.className='board-grid';
  for(let i=start;i<=end;i++){ let cell=tablero[i];
    const d=document.createElement('div'); d.className='board-space';
    if(jugador&&jugador.posicion===i)d.classList.add('active');
    d.innerHTML=`<div>${i}</div><div>${cell.icon}</div>`;
    grid.appendChild(d);
  }
  bc.appendChild(grid);
}
function actualizarEmpresaDashboard(){
  if(!jugador)return;
  const cm=document.getElementById('company-metrics');
  cm.innerHTML=jugador.empresa.estado().replace(/\n/g,'<br>');
}

// --- Inicio y Turno ---
function initJuego(){
  const nombre=document.getElementById('nombre').value.trim();
  if(!nombre){showOutput('❗ Ingresa nombre.');return;}
  jugador=new Jugador(nombre);gameOver=false;esperandoDecision=false;clearDialog();
  document.getElementById('juego').style.display='block';
  showOutput(`🎮 Bienvenido ${nombre}!<br>`+jugador.mostrarEstado().replace(/\n/g,'<br>'));
  actualizarTablero();actualizarEmpresaDashboard();
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
  actualizarTablero();
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
  // 0: Casilla 1 - Tendencia Viral en Redes Sociales
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>CASILLA 1: Tendencia Viral en Redes Sociales</strong><br>
        <em>Un influencer menciona tu producto en redes sociales sin costo alguno, y esto genera un aumento explosivo de visibilidad.</em>
        <ul class="mt-2 mb-2">
          <li><b>Efecto:</b> Recibes ingresos normales y avanzas una casilla extra.</li>
          <li><b>Costos:</b> N.A</li>
        </ul>
        <div class="mt-3">
          <button id="ok-0" class="btn btn-success me-2">Tomar efecto</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-0').onclick = () => {
      clearDialog();
      jugador.posicion++;
      actualizarTablero();
      showOutput(
        `<strong>Tendencia Viral en Redes Sociales:</strong><br>
        Un influencer menciona tu producto en redes sociales sin costo alguno, y esto genera un aumento explosivo de visibilidad.<br>
        <b>¡Avanzas una casilla extra y recibes ingresos!</b>`
      );
      esperandoDecision = false;
    };
  },
  // 1: Casilla 4 - Tercerización en la distribución
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>CASILLA 4: Tercerización en la distribución</strong><br>
        <em>Una trasportadora te ofrece el servicio de distribución de tu producto a un precio más bajo.</em>
        <ul class="mt-2 mb-2">
          <li><b>Debes invertir:</b> $15,000</li>
          <li><b>Efecto:</b> Disminuye los gastos operacionales en un 5%</li>
        </ul>
        <div class="mt-3">
          <button id="ok-1" class="btn btn-success me-2">Aceptar</button>
          <button id="no-1" class="btn btn-secondary">Rechazar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-1').onclick = () => {
      clearDialog();
      if (jugador.empresa.balance >= 15000) {
        jugador.empresa.pagarGastos(15000);
        jugador.empresa.gastoOperacional = Math.floor(jugador.empresa.gastoOperacional * 0.95);
        actualizarEmpresaDashboard();
        showOutput('<strong>Tercerización:</strong> Gastos operacionales disminuidos en un 5%.');
      } else {
        showOutput('<strong>Tercerización:</strong> Fondos insuficientes.');
      }
      esperandoDecision = false;
    };
    document.getElementById('no-1').onclick = () => {
      clearDialog();
      showOutput('<em>Rechazas la oportunidad.</em>');
      esperandoDecision = false;
    };
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
        <strong>CASILLA 10: Campaña de Marketing</strong><br>
        <em>Una de las mejores agencias de marketing te propone una campaña prometedora que aumentaría tu demanda.</em>
        <ul class="mt-2 mb-2">
          <li><b>Debes invertir:</b> $7,000</li>
          <li><b>Efecto:</b> Puedes lanzar dos veces y avanzar la suma de los dados</li>
        </ul>
        <div class="mt-3">
          <button id="ok-3" class="btn btn-success me-2">Aceptar</button>
          <button id="no-3" class="btn btn-secondary">Rechazar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-3').onclick = () => {
      if (jugador.empresa.balance < 7000) {
        clearDialog();
        showOutput('<strong>Campaña:</strong> Fondos insuficientes.');
        esperandoDecision = false;
        return;
      }
      jugador.empresa.pagarGastos(7000);
      clearDialog();
      const dlg2 = `
        <div class="alert alert-info">
          Ingresa resultados de dos dados:<br>
          <input id="m1" type="number" min="1" max="6" placeholder="Dado 1"><br>
          <input id="m2" type="number" min="1" max="6" placeholder="Dado 2"><br>
          <button id="conf-3" class="btn btn-primary mt-2">Confirmar</button>
        </div>`;
      document.getElementById('dialog-container').innerHTML = dlg2;
      document.getElementById('conf-3').onclick = () => {
        const d1 = parseInt(document.getElementById('m1').value);
        const d2 = parseInt(document.getElementById('m2').value);
        if ([d1, d2].some(x => isNaN(x) || x < 1 || x > 6)) return alert('Dados 1-6');
        const suma = d1 + d2;
        jugador.posicion += suma;
        clearDialog();
        showOutput(`<strong>Campaña de Marketing:</strong> Avanzas ${suma} casillas (suma de los dados).`);
        actualizarTablero();
        actualizarEmpresaDashboard();
        esperandoDecision = false;
      };
    };
    document.getElementById('no-3').onclick = () => {
      clearDialog();
      showOutput('<em>Rechazas la oportunidad.</em>');
      esperandoDecision = false;
    };
  },
  // 4: Casilla 13 - Concurso de emprendimiento
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>CASILLA 13: Concurso de emprendimiento</strong><br>
        <em>Al inscribirte en la competencia, el premio al proyecto ganador es una inversión en maquinaria para optimizar procesos.</em>
        <ul class="mt-2 mb-2">
          <li><b>Debes perder un turno</b> para la postulación en la competencia</li>
          <li><b>Efecto:</b> Disminuyes en un 15% tu costo de producción</li>
        </ul>
        <div class="mt-3">
          <button id="ok-4" class="btn btn-success me-2">Aceptar</button>
          <button id="no-4" class="btn btn-secondary">Rechazar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-4').onclick = () => {
      clearDialog();
      jugador.turnosPerdidos++;
      jugador.empresa.costoProduccion = Math.floor(jugador.empresa.costoProduccion * 0.85);
      actualizarEmpresaDashboard();
      showOutput('<strong>Concurso de emprendimiento:</strong> Pierdes un turno y disminuyes en un 15% tu costo de producción.');
      esperandoDecision = false;
    };
    document.getElementById('no-4').onclick = () => {
      clearDialog();
      showOutput('<em>Rechazas la oportunidad.</em>');
      esperandoDecision = false;
    };
  },
  // 5: Casilla 17 - Desarrollo de nuevo producto/servicio
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>CASILLA 17: Desarrollo de nuevo producto/servicio</strong><br>
        <em>Tu equipo de innovación lanza un producto revolucionario.</em>
        <ul class="mt-2 mb-2">
          <li><b>Condición:</b> Se debe pagar una fase de investigación y desarrollo: $19,000</li>
          <li><b>Efecto:</b> Lanza un dado. Si el resultado es par, la venta del próximo movimiento se duplica (+100%). Si es impar, aumentan en un 50%.</li>
        </ul>
        <div class="mt-3">
          <button id="ok-5" class="btn btn-success me-2">Pagar y lanzar dado</button>
          <button id="no-5" class="btn btn-secondary">Rechazar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-5').onclick = () => {
      clearDialog();
      if (jugador.empresa.balance >= 19000) {
        jugador.empresa.pagarGastos(19000);
        // Pedir al usuario que ingrese el resultado del dado
        document.getElementById('dialog-container').innerHTML = `
          <div class="alert alert-info">
            Ingresa el resultado de tu dado (1-6):<br>
            <input id="dado-c17" type="number" min="1" max="6" class="form-control w-auto d-inline-block" style="width:80px;display:inline-block;" placeholder="Dado">
            <button id="conf-c17" class="btn btn-primary mt-2">Confirmar</button>
          </div>`;
        document.getElementById('conf-c17').onclick = () => {
          const valor = parseInt(document.getElementById('dado-c17').value);
          if (isNaN(valor) || valor < 1 || valor > 6) {
            alert('Ingresa un valor entre 1 y 6.');
            return;
          }
          clearDialog();
          if (valor % 2 === 0) {
            jugador.empresa.bonificacionVentas = 2.0;
            jugador.empresa.rondasBonificacion = 1;
            showOutput('<strong>¡Dado par!</strong> La venta del próximo movimiento se duplica (+100%).');
          } else {
            jugador.empresa.bonificacionVentas = 1.5;
            jugador.empresa.rondasBonificacion = 1;
            showOutput('<strong>¡Dado impar!</strong> La venta del próximo movimiento aumenta en un 50%.');
          }
          actualizarEmpresaDashboard();
          esperandoDecision = false;
        };
      } else {
        showOutput('<strong>Desarrollo de nuevo producto:</strong> Fondos insuficientes.');
        esperandoDecision = false;
      }
    };
    document.getElementById('no-5').onclick = () => {
      clearDialog();
      showOutput('<em>Rechazas la oportunidad.</em>');
      esperandoDecision = false;
    };
  },
  // 6: Casilla 20 - Inversión en Tecnología
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>CASILLA 20: Inversión en Tecnología</strong><br>
        <em>Tu empresa adopta inteligencia artificial para mejorar la productividad.</em>
        <ul class="mt-2 mb-2">
          <li><b>Condición:</b> Requiere invertir $22,000</li>
          <li><b>Efecto:</b> Disminuye el costo de producción en un 15%</li>
        </ul>
        <div class="mt-3">
          <button id="ok-6" class="btn btn-success me-2">Invertir</button>
          <button id="no-6" class="btn btn-secondary">Rechazar</button>
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
        showOutput('<strong>Inversión en Tecnología:</strong> Disminuyes el costo de producción en un 15%.');
      } else {
        showOutput('<strong>Inversión en Tecnología:</strong> Fondos insuficientes.');
      }
      esperandoDecision = false;
    };
    document.getElementById('no-6').onclick = () => {
      clearDialog();
      showOutput('<em>Rechazas la oportunidad.</em>');
      esperandoDecision = false;
    };
  },

  // 7: Casilla 23 - Nuevo proveedor de materia prima
  () => {
    clearDialog();
    const html = `
      <div class="alert alert-primary">
        <strong>CASILLA 23: Nuevo proveedor de materia prima</strong><br>
        <em>Has encontrado un proveedor que te ofrece la materia prima a un 5% más bajo.</em>
        <ul class="mt-2 mb-2">
          <li><b>Condición:</b> N.A</li>
          <li><b>Efecto:</b> Disminuye directamente tu costo de producción en un 5% y aumenta tus ingresos en un 10%.</li>
        </ul>
        <div class="mt-3">
          <button id="ok-7" class="btn btn-success me-2">Aceptar</button>
          <button id="no-7" class="btn btn-secondary">Rechazar</button>
        </div>
      </div>`;
    document.getElementById('dialog-container').innerHTML = html;
    esperandoDecision = true;
    document.getElementById('ok-7').onclick = () => {
      clearDialog();
      jugador.empresa.costoProduccion = Math.floor(jugador.empresa.costoProduccion * 0.95);
      // Aumenta ingresos netos en 10%
      const aumento = Math.floor(jugador.empresa.ingresosNetos * 0.10);
      jugador.empresa.actualizarIngresos(aumento);
      actualizarEmpresaDashboard();
      showOutput('<strong>Nuevo proveedor:</strong> Disminuyes tu costo de producción en un 5% y aumentan tus ingresos en un 10%.');
      esperandoDecision = false;
    };
    document.getElementById('no-7').onclick = () => {
      clearDialog();
      showOutput('<em>Rechazas la oportunidad.</em>');
      esperandoDecision = false;
    };
  },
  // ...existing code...
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
    actualizarTablero();
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
    actualizarEmpresaDashboard();
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
    actualizarTablero();
    actualizarEmpresaDashboard();
    showOutput(`<strong>Problema de Calidad</strong><br>Retrocedes 2 casillas.`);
  },
  // Casilla 35: Incendio en Planta. Retrocedes 3 casillas y pierdes 3 turnos.
  () => {
    jugador.posicion = Math.max(0, jugador.posicion - 3);
    jugador.turnosPerdidos += 3;
    actualizarTablero();
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
      actualizarTablero();
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
    actualizarTablero();
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



