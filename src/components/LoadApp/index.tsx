import { ReactElement, useEffect, useState } from "react"
import { bitable } from "@lark-base-open/js-sdk"
import './style.css'

export default function LoadApp(props: { neverShowBanner?: boolean, children: ReactElement }): ReactElement {
  const [loadErr, setLoadErr] = useState(false)

  const TopBanner = <div>
    <div className='errTop'>
      请在飞书多维表格中通过“插件 - 自定义插件”打开本页面。&nbsp;
      <a target='_blank' rel='noreferrer' href='https://feishu.feishu.cn/docx/S1pMdbckEooVlhx53ZMcGGnMnKc'>开发指南</a>
    </div>
  </div>
  useEffect(() => {
    if (props.neverShowBanner) return;
    const timer = new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(false)
      }, 3000)
    })
    Promise.race([bitable.bridge.getLanguage(), timer]).then((v) => {
      setLoadErr(false)
    }).catch(() => {
      setLoadErr(true)
    })
  }, [])

  if (props.neverShowBanner) {
    return props.children || null
  }

  return <div>
    {loadErr && TopBanner}
    {props.children}
  </div>
}

