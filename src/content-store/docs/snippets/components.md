---
title: 'Documentation'
description: 'Documentation documentation'
pubDate: 2024-01-15
author: 'Pixelated Team'
tags: ['documentation', 'components']
draft: false
toc: true
---

export const HeroCard = ({ img, title, description, href }) => {
  return (
    <a className="border-b pb-8 cursor-pointer border-gray-500 dark:border-gray-800 hover:!border-primary dark:hover:!border-primary-light" href={href}>
      <img src={img} />
      <h1 className="mt-4 font-semibold text-gray-900 dark:text-white">{title}</h1>
      <h2 className="mt-1 text-gray-600 dark:text-gray-400 text-sm leading-6">{description}</h2>
    </a>
  )

}
