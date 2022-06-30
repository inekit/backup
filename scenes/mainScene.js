const { Telegraf, Composer, Scenes: { WizardScene } } = require('telegraf')

const { CustomWizardScene, titles} = require('telegraf-steps-engine');
const { confirmDialog } = require('telegraf-steps-engine/replyTemplates');
const tOrmCon = require("../db/data-source");

const clientScene = new CustomWizardScene('clientScene')
.enter(async ctx=>{

    /*if (!(await checkSubscription(ctx))) {
        await ctx.replyWithPhoto('AgACAgIAAxkBAAICXGKou9pIMB83HdvoqSl7q27T2pV_AALtvTEbmWVISTGw020E7Ay1AQADAgADcwADJAQ').catch(console.log)
        return ctx.replyWithKeyboard("GREETING", 'subscribe_keyboard')
    }*/

    const connection = await tOrmCon

    let menu=[['FIND_NEAREST_SCENE_BUTTON']]
    let userObj = (await connection.query(
            "SELECT id, DATEDIFF(now(),u.lastUse) loginAgo,userId FROM navigator.users u left join navigator.admins a on a.userId = u.id where u.id = ? limit 1", 
            [ctx.from?.id])
        .catch((e)=>{
            console.log(e)
            ctx.replyWithTitle("DB_ERROR")
        }))

    userObj = userObj?.[0]

    if (!userObj) {

        //ctx.replyWithKeyboard("GREETING", {name: 'custom_bottom_keyboard', args: [menu]})
        
        userObj = await connection.getRepository("User")
        .save({id: ctx.from.id})
        .catch((e)=>{
            console.log(e)
            ctx.replyWithTitle("DB_ERROR")
        })
    }
    if (userObj?.userId) menu.push(['ADMIN_SCENE_BUTTON'])
    
    if (userObj?.loginAgo!=="0") {
        await connection.query(
            "UPDATE navigator.users u SET lastUse = now() WHERE id = ?", 
            [ctx.from?.id])
        .catch((e)=>{
            console.log(e)
            ctx.replyWithTitle("DB_ERROR")
        })
    }

    
    
    ctx.replyWithKeyboard("HOME_MENU", {name: 'custom_bottom_keyboard', args: 
    [menu]})
    
    
    
})	


async function checkSubscription(ctx){

    const res = await ctx.telegram.getChatMember(-1001388153893, ctx.from?.id).catch(console.log)

    if (!res) return

    if(res?.status === 'administrator' || res?.status === 'creator' || res?.status === 'member') return true

    return
}

clientScene.action('checkSubscribe', async ctx=>{
    await ctx.answerCbQuery().catch(console.log)

    ctx.scene.reenter()
})

clientScene.hears(titles.getTitle('FIND_NEAREST_SCENE_BUTTON','ru'), ctx=>{
    ctx.scene.enter('findNearestScene').catch(e=>ctx.replyWithTitle(`Нет такой сцены findNearestScene`));
})

clientScene.hears(titles.getTitle('ADMIN_SCENE_BUTTON','ru'), ctx=>{
    ctx.scene.enter('adminScene').catch(e=>ctx.replyWithTitle(`Нет такой сцены`));
})

module.exports = [clientScene]
