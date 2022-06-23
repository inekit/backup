const points = require("./points.json");
const Nominatim = require('nominatim-geocoder')
const db = require('./db/dbClient');
const { confirmDialog } = require("telegraf-steps-engine/replyTemplates");
const geocoder = new Nominatim()
const conn = db.createConnection()


async function parseCity({city, street, house, building,name}){
    const addr = `${street} ${house}${building? ' '+building :""}`
    const r = await geocoder.search( { street: addr, city: city, countrycodes:"ru", limit:5 } )
        .then(async (response) => {
            //console.log(city, street,response[0]?.display_name,response[0]?.display_name.includes(city.trim()))
            if (!response[0]?.lat || !response[0]?.lon || !response[0]?.display_name.includes(city.trim())) return {city, street, house, building,name}//console.log(city, addr, response[0]?.display_name, response[0]?.lat,response[0]?.lon,)
            
            conn.query(`select * from addresses where cityId=(select id from cities where name = ? limit 1) and name=? and street=? and house=? and (building=? or ? is null) limit 1`,
                [city.trim(), name, street, house, building,building],(e,res)=>{
                        if (!res?.length) {
                            conn.query(`insert into addresses (cityId, name, street, house, building, latitude, longitude)
                            values ((select id from navigator.cities c where c.name = ? limit 1), 
                                ?,?,?,?,?,?
                                )`,
                                [city.trim(), name, street, house, building, response[0]?.lat, response[0]?.lon])
                            console.log('Добавлен')
                        }
                        else console.log('Уже существует')
                    })

            
            
        })

    return r
}

const cities = new Set()

async function parseCities(){
    points?.["Лист1"].forEach(async p=>{
        console.log(0, p, p.city)
        
        await cities.add(p.city.trim())
    })
}

async function insertCities(){
    cities.forEach(async c=>{
        conn.query('insert into navigator.cities (name) values (?)',[c],(e,r)=>{
            if (e) return;
        })
    })
}

async function deleteCities(){
    conn.query('delete from navigator.cities where 1=1')
}

async function deletePoints(){
    conn.query('delete from navigator.addresses where 1=1')
}


async function parsePoints(){
    const unresolved = new Set()
    console.log(1)
    points?.["Лист1"].forEach(async point => {
        unresolved.add(await parseCity(point))
        console.log(unresolved)

    });
}

async function parse(){

    //await deleteCities()

    await parseCities()

    await insertCities()

    //await deletePoints()

    await parsePoints()

}

parse()



/*
cities.forEach(async c=>{
     conn.query('insert into navigator.cities (name) values (?)',[c])
    }) */


/*
*/