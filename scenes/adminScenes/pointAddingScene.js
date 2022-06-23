const { Telegraf, Composer, Scenes: { WizardScene } } = require('telegraf')

const { CustomWizardScene, titles} = require('telegraf-steps-engine')
const tOrmCon = require("../../db/data-source");
const coordinatesByAddr = require("../../Utils/coordinatesByAddr");
const Nominatim = require('nominatim-geocoder')
const geocoder = new Nominatim()

const confirmHandler = new Composer(), coordinatesHandler = new Composer(), addressHandler = new Composer(), cityHandler = new Composer();

confirmHandler.on('text',async ctx=>{

    const name = ctx.message?.text
    if (!name || name?.length > 45) return ctx.replyWithTitle("TOO_LONG_STRING")
    if (!ctx.wizard.state.input) ctx.wizard.state.input = {name}
    else ctx.wizard.state.input.name = name
    

    ctx.replyWithKeyboard('ENTER_LOCATION_ADDRESS_ADMIN', 'send_location_keyboard_admin');

    ctx.wizard.next()
})


cityHandler.action(/^city\-([0-9]+)$/g, async ctx => {
    console.log(1)

    await ctx.answerCbQuery().catch(console.log)

    ctx.wizard.state.input.cityId = ctx.match[1]

    ctx.replyNextStep()

})

addressHandler.on('location', async ctx => {
    if(!ctx.message.location) return;

    let {latitude, longitude} = ctx.message.location

    ctx.scene.state.input.latitude = latitude;
    ctx.scene.state.input.longitude = longitude;

    const input = ctx.scene.state.input;


    await ctx.telegram.sendLocation(ctx.from.id, latitude, longitude)
    await ctx.replyWithKeyboard('POINT_ADDING_INFO',
    'admin_back_keyboard',[input.name, ctx.scene.state.city])

    if (input.name && input.street && input.house) 
        return await ctx.replyWithKeyboard('FINISH_POINT_ADDING','confirm_keyboard')
    await ctx.replyWithTitle('ENTER_FULL_ADDRESS')
   
    ctx.scene.state.locationCorrect = true;

})


addressHandler.action('skip',ctx=>{
    ctx.replyWithKeyboard('SKIP', 'admin_back_keyboard');

})

addressHandler.on('text',async (ctx)=>{
    const address = ctx.message?.text

    const addrReg = /^([0-9а-яА-ЯЁ\-ё]{2,40}\s?[а-яА-ЯЁ\-ё]{0,40}\s?[а-яА-ЯЁ\-ё]{0,40})\s?([0-9\/\.]{1,7})\s?([\wа-яА-ЯЁё0-9]{1,5})?$/g.exec(address)

    console.log(addrReg)
    if (!addrReg) return ctx.replyWithTitle("WRONG_ADDR_FORMAT")

    geocoder.search( { street: addrReg?.[0], city: ctx.scene.state.city, countrycodes:"ru", limit:5 } )
    .then(async (response) => {

        ctx.scene.state.input = ctx.scene.state.input ?? {}
        

        ctx.scene.state.input.name;
        ctx.scene.state.input.street = addrReg?.[1];
        ctx.scene.state.input.house = addrReg?.[2];
        ctx.scene.state.input.building = addrReg?.[3];

        if (!response || !response.length) throw new Error("CANT RECOGNIZE ADDRESS");


        if (!locationCorrect) {
            ctx.scene.state.input.latitude = response[0]?.lat;
            ctx.scene.state.input.longitude = response[0]?.lon;
        }
        
        let input = ctx.scene.state.input;

        await ctx.telegram.sendLocation(ctx.from.id, ctx.scene.state.input.latitude, ctx.scene.state.input.longitude)
        
        if (!ctx.scene.state.locationCorrect) {
            await ctx.replyWithKeyboard('POINT_ADDING_INFO','admin_back_keyboard',
            [input.name, `${ctx.scene.state.city}, ул. ${input.street}, д. ${input.house}${input.building? ', к. '+input.building : "" }`])
    
            return await ctx.replyWithKeyboard('CHECK_LOCATION_ADMIN','confirm_keyboard')
        } 
        await ctx.replyWithKeyboard('.','admin_back_keyboard')
        await ctx.replyWithKeyboard('POINT_ADDING_INFO','confirm_keyboard',
        [input.name, `${ctx.scene.state.city}, ул. ${input.street}, д. ${input.house}${input.building? ', к. '+input.building : "" }`])

        /*for (i in response){
            let suggestion=response[i]
            const {lat, lon,display_name} = suggestion
            await ctx.telegram.sendLocation(ctx.from.id, lat, lon)
            if (i==response.length-1) 
             await ctx.replyWithKeyboard('POINT_INFO_ADMIN','skip_keyboard', [p.distance.toFixed(1), p.pointName,p.description])
            else await ctx.replyWithTitle('POINT_INFO_ADMIN',[display_name, p.description]);
        }*/
    })
    .catch(async (error) => {
        if (!ctx.scene.state.locationCorrect) return ctx.replyWithTitle("CANT RECOGNIZE ADDRESS")
        
        await ctx.replyWithKeyboard('.','admin_back_keyboard')
        await ctx.replyWithKeyboard('POINT_ADDING_INFO','confirm_keyboard',
        [ctx.scene.state.input?.name, `${ctx.scene.state.city}, ул. ${addrReg?.[1]}, д. ${addrReg?.[2]}${addrReg?.[3]? ', к. '+addrReg?.[3] : "" }`])

    })
    
})



addressHandler.action('confirm',async (ctx)=>{
    const input = {latitude,longitude, name, street, house, building} = ctx.scene.state.input
    const cityId = ctx.scene.state.cityId;

    const res = await (require('../../Utils/authAdmin')(ctx.from.id))
    .catch(()=>{ ctx.answerCbQuery("CANT_AUTH");return ctx.scene.enter('clientScene');})


    if (!res) { return ctx.scene.enter('clientScene');}

    const connection = await tOrmCon
    await connection.query(
        `insert into addresses (name,cityId,street,house,building,latitude,longitude) 
        values (?,?,?,?,?,?,?)`, [ctx.scene.state.input.name, cityId, street, house, building, latitude, longitude])
    .then(async ()=>{
        await ctx.answerCbQuery("CITY_HAS_BEEN_ADDED").catch(console.log)
    })
    .catch(async (e)=>{ 
        console.log(e)
        await ctx.answerCbQuery("CITY_HAS_NOT_BEEN_ADDED").catch(console.log) 
    })

    delete ctx.scene.state.cityId;
    delete ctx.scene.state.input;
    delete ctx.scene.state.locationCorrect;
  
    ctx.scene.enter('citiesScene')
})

const pointAddingScene = new CustomWizardScene('pointAddingScene')
.addStep({variable: 'name', handler:confirmHandler})
.addStep({variable: 'address', confines:['sting255'], type:"confirm", handler: addressHandler})
.addStep({variable: 'coordinates', type:"confirm", handler: addressHandler})



    module.exports = pointAddingScene